import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  SAFETY_TRAINING_TYPE,
  type TrainingAssignment,
  type TrainingModule,
} from '@/lib/training/trainingTypes';

/** A single scheduled safety-training session derived from a module's lessons. */
export interface SafetyTrainingSession {
  moduleId: string;
  moduleTitle: string;
  lessonTitle: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' or '' */
  time: string;
}

/**
 * The scheduled sessions of a safety-training module — one entry per lesson
 * that carries a `scheduledDate`. Mirrors the derivation the Safety Calendar
 * uses so the Training tab surfaces the same schedule.
 */
export function getModuleSessions(module: TrainingModule): SafetyTrainingSession[] {
  const moduleTitle = module.title || 'Safety Training';
  const out: SafetyTrainingSession[] = [];
  for (const l of module.lessons ?? []) {
    if (l.scheduledDate) {
      out.push({
        moduleId: module.id,
        moduleTitle,
        lessonTitle: l.title ?? '',
        date: l.scheduledDate,
        time: l.scheduledTime ?? '',
      });
    }
  }
  return out;
}

/** True when a module is a Safety Training module. */
export function isSafetyModule(m: Pick<TrainingModule, 'trainingType'>): boolean {
  return m.trainingType === SAFETY_TRAINING_TYPE;
}

/** True when an assignment is for a Safety Training module. */
export function isSafetyAssignment(
  a: Pick<TrainingAssignment, 'trainingType'>,
  safetyModuleIds: Set<string>,
  moduleId?: string,
): boolean {
  return a.trainingType === SAFETY_TRAINING_TYPE || (moduleId ? safetyModuleIds.has(moduleId) : false);
}

/** Live Safety Training modules for the company. */
export function useSafetyTrainingModules(companyId: string | undefined) {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
      (snap) => {
        setModules(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as TrainingModule))
            .filter((m) => m.trainingType === SAFETY_TRAINING_TYPE),
        );
        setLoading(false);
      },
      () => {
        setModules([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  const modulesById = useMemo(() => {
    const m = new Map<string, TrainingModule>();
    for (const mod of modules) m.set(mod.id, mod);
    return m;
  }, [modules]);

  const moduleIds = useMemo(() => new Set(modules.map((m) => m.id)), [modules]);

  return { modules, modulesById, moduleIds, loading };
}

/**
 * Every Safety Training assignment across the company, for the manager view.
 * An assignment counts as safety when its own `trainingType` is Safety Training
 * or its module is a Safety Training module (covers assignments predating the
 * per-assignment `trainingType` field).
 */
export function useCompanySafetyAssignments(
  companyId: string | undefined,
  safetyModuleIds: Set<string>,
) {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment)));
        setLoading(false);
      },
      () => {
        setAssignments([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  const safety = useMemo(
    () => assignments.filter((a) => isSafetyAssignment(a, safetyModuleIds, a.moduleId)),
    [assignments, safetyModuleIds],
  );

  return { assignments: safety, loading };
}
