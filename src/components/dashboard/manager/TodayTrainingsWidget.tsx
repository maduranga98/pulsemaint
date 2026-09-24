import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { getModuleSessions, isSafetyModule } from '../../../hooks/training/useSafetyTrainings';
import type { TrainingModule } from '../../../lib/training/trainingTypes';
import { usePlantUserIds } from '../../../hooks/usePlantUserIds';

/** Module ids assigned to at least one of the given users — training
 * modules are company-wide content, so a plant's "today's trainings" are the
 * sessions of modules its own people are enrolled in. Null = no filter. */
function useModuleIdsForUsers(companyId: string, userIds: Set<string> | null) {
  const [moduleIds, setModuleIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!companyId || !userIds) {
      setModuleIds(null);
      return;
    }
    setModuleIds(new Set());
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        const ids = new Set<string>();
        snap.docs.forEach((d) => {
          const a = d.data() as { traineeId?: string; moduleId?: string };
          if (a.moduleId && a.traineeId && userIds.has(a.traineeId)) ids.add(a.moduleId);
        });
        setModuleIds(ids);
      },
      () => setModuleIds(new Set()),
    );
    return () => unsub();
  }, [companyId, userIds]);

  return moduleIds;
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
  const plantUserIds = usePlantUserIds(companyId);
  const plantModuleIds = useModuleIdsForUsers(companyId, plantUserIds);
  const todayStr = new Date().toISOString().slice(0, 10);

  const todaySessions = useMemo(() => {
    return modules
      .filter((m) => !plantModuleIds || plantModuleIds.has(m.id))
      .flatMap((m) => getModuleSessions(m).map((s) => ({ ...s, safety: isSafetyModule(m) })))
      .filter((s) => s.date === todayStr)
      .filter((s) => !safetyOnly || s.safety);
  }, [modules, todayStr, safetyOnly, plantModuleIds]);

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
        <div className="space-y-1.5">
          {todaySessions.map((s, i) => (
            <div
              key={`${s.moduleId}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#F0F4F8]">{s.moduleTitle}</p>
                <p className="truncate text-[11px] text-[#8BA3BF]">{s.lessonTitle}{s.time ? ` · ${s.time}` : ''}</p>
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
