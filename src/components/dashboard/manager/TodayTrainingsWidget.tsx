import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { getModuleSessions, isSafetyModule } from '../../../hooks/training/useSafetyTrainings';
import type { TrainingAssignment, TrainingModule } from '../../../lib/training/trainingTypes';
import { usePlantUserIds } from '../../../hooks/usePlantUserIds';

type Ts = { toDate?: () => Date } | null | undefined;

/** Local calendar date 'YYYY-MM-DD' (toISOString would give the UTC date,
 * which is yesterday for the first hours of the day in UTC+ time zones). */
function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const tsDateStr = (ts: Ts) => (ts?.toDate ? localDateStr(ts.toDate()) : null);

/** Live training assignments for the company (every kind). */
function useCompanyAssignments(companyId: string) {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);

  useEffect(() => {
    if (!companyId) {
      setAssignments([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment)),
      () => setAssignments([]),
    );
    return () => unsub();
  }, [companyId]);

  return assignments;
}

type SessionKind = 'lesson' | 'practice' | 'test' | 'external' | 'due';

interface TodaySession {
  key: string;
  moduleId: string;
  title: string;
  detail: string;
  time: string;
  kind: SessionKind;
  safety: boolean;
}

/** Every training module for the company — safety and general alike, since
 * getModuleSessions/isSafetyModule work on any module regardless of scope. */
function useAllTrainingModules(companyId: string) {
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
        setModules(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingModule));
        setLoading(false);
      },
      () => {
        setModules([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  return { modules, loading };
}

interface TodayTrainingsWidgetProps {
  companyId: string;
  /** Only show sessions from Safety Training modules — used on the Safety
   *  Dashboard, where "today's trainings" should mean safety trainings only. */
  safetyOnly?: boolean;
}

export default function TodayTrainingsWidget({ companyId, safetyOnly = false }: TodayTrainingsWidgetProps) {
  const { t } = useTranslation();
  const { modules, loading } = useAllTrainingModules(companyId);
  const assignments = useCompanyAssignments(companyId);
  // Plant tab on top (admin) / the caller's own plant — null = All Plants.
  const plantUserIds = usePlantUserIds(companyId);
  const todayStr = localDateStr(new Date());

  const todaySessions = useMemo<TodaySession[]>(() => {
    // Plant filter: a module belongs to the selected plant when someone in
    // that plant is enrolled in it. Modules nobody is enrolled in yet aren't
    // tied to any plant, so their scheduled sessions show under every plant.
    const assignedModuleIds = new Set(assignments.map((a) => a.moduleId));
    const plantAssignments = plantUserIds
      ? assignments.filter((a) => plantUserIds.has(a.traineeId))
      : assignments;
    const plantModuleIds = new Set(plantAssignments.map((a) => a.moduleId));
    const inPlant = (moduleId: string) => !plantUserIds || plantModuleIds.has(moduleId) || !assignedModuleIds.has(moduleId);
    const moduleById = new Map(modules.map((m) => [m.id, m]));

    const out: TodaySession[] = [];
    for (const m of modules) {
      if (!inPlant(m.id)) continue;
      const safety = isSafetyModule(m);
      // Scheduled lessons
      getModuleSessions(m)
        .filter((sess) => sess.date === todayStr)
        .forEach((sess, i) => out.push({
          key: `${m.id}-l${i}`, moduleId: m.id, title: m.title, detail: sess.lessonTitle, time: sess.time, kind: 'lesson', safety,
        }));
      // Scheduled practice quiz / final test
      if (m.practiceQuiz?.scheduledDate === todayStr) {
        out.push({ key: `${m.id}-pq`, moduleId: m.id, title: m.title, detail: m.practiceQuiz.title || '', time: m.practiceQuiz.scheduledTime ?? '', kind: 'practice', safety });
      }
      if (m.quiz?.scheduledDate === todayStr) {
        out.push({ key: `${m.id}-q`, moduleId: m.id, title: m.title, detail: m.quiz.title || '', time: m.quiz.scheduledTime ?? '', kind: 'test', safety });
      }
    }

    const done = new Set(['certified', 'expired']);
    for (const a of plantAssignments) {
      const m = moduleById.get(a.moduleId);
      const safety = m ? isSafetyModule(m) : a.trainingType === 'safety_training';
      // External / offboard training running today
      const od = a.offboardDetails;
      const from = tsDateStr(od?.startDate);
      const to = tsDateStr(od?.endDate) ?? from;
      if (from && to && from <= todayStr && todayStr <= to) {
        out.push({
          key: `${a.id}-x`, moduleId: a.moduleId, title: a.moduleName, time: '', kind: 'external', safety,
          detail: [a.traineeName, od?.thirdPartyCompany].filter(Boolean).join(' · '),
        });
      }
      // Assigned training due today and not finished yet
      if (tsDateStr(a.dueDate) === todayStr && !done.has(a.status)) {
        out.push({ key: `${a.id}-d`, moduleId: a.moduleId, title: a.moduleName, detail: a.traineeName, time: '', kind: 'due', safety });
      }
    }

    return out
      .filter((sess) => !safetyOnly || sess.safety)
      .sort((x, y) => (x.time || '99:99').localeCompare(y.time || '99:99'));
  }, [modules, assignments, plantUserIds, todayStr, safetyOnly]);

  const kindLabel: Record<SessionKind, string> = {
    lesson: t('common.dashboard.trainings.kindLesson', { defaultValue: 'Session' }),
    practice: t('common.dashboard.trainings.kindPractice', { defaultValue: 'Practice quiz' }),
    test: t('common.dashboard.trainings.kindTest', { defaultValue: 'Final test' }),
    external: t('common.dashboard.trainings.kindExternal', { defaultValue: 'External training' }),
    due: t('common.dashboard.trainings.kindDue', { defaultValue: 'Due today' }),
  };

  return (
    <DashboardWidget
      title={safetyOnly ? "Today's Safety Trainings" : t('common.dashboard.trainings.title')}
      loading={loading}
      live
      action={<span className="text-xs text-[#8BA3BF]">{t('common.dashboard.trainings.today', { count: todaySessions.length })}</span>}
    >
      {todaySessions.length === 0 ? (
        <EmptyState message={t('common.dashboard.trainings.empty')} />
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {todaySessions.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#F0F4F8]">{s.title}</p>
                <p className="truncate text-[11px] text-[#8BA3BF]">
                  {kindLabel[s.kind]}{s.detail ? ` · ${s.detail}` : ''}{s.time ? ` · ${s.time}` : ''}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  s.safety ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#1A56DB]/20 text-[#5B8DEF]'
                }`}
              >
                {s.safety ? t('common.dashboard.trainings.safety') : t('common.dashboard.trainings.general')}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
