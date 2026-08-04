import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { getModuleSessions, isSafetyModule } from '../../../hooks/training/useSafetyTrainings';
import type { TrainingModule } from '../../../lib/training/trainingTypes';

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

export default function TodayTrainingsWidget({ companyId }: { companyId: string }) {
  const { modules, loading } = useAllTrainingModules(companyId);
  const todayStr = new Date().toISOString().slice(0, 10);

  const todaySessions = useMemo(() => {
    return modules
      .flatMap((m) => getModuleSessions(m).map((s) => ({ ...s, safety: isSafetyModule(m) })))
      .filter((s) => s.date === todayStr);
  }, [modules, todayStr]);

  return (
    <DashboardWidget
      title="Today's Trainings"
      loading={loading}
      live
      action={<span className="text-xs text-[#8BA3BF]">{todaySessions.length} today</span>}
    >
      {todaySessions.length === 0 ? (
        <EmptyState message="No trainings scheduled today" />
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
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
                {s.safety ? 'Safety' : 'General'}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
