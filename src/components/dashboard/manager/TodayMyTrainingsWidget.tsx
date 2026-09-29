import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useMyAssignments } from '../../../hooks/training/useMyAssignments';
import { getModuleSessions, isSafetyModule } from '../../../hooks/training/useSafetyTrainings';
import type { TrainingModule } from '../../../lib/training/trainingTypes';
import { useTranslation } from 'react-i18next';

function useCompanyTrainingModules(companyId: string) {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
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

/** Local calendar date 'YYYY-MM-DD' (toISOString gives the UTC date, which is
 * wrong for part of the day in non-UTC time zones). */
function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local date, re-evaluated at local midnight so a dashboard left open
 * overnight rolls over to the new day without a reload. */
function useLocalToday(): string {
  const [today, setToday] = useState(() => localDateStr(new Date()));

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const timer = window.setTimeout(() => setToday(localDateStr(new Date())), nextMidnight - now.getTime() + 1000);
    return () => window.clearTimeout(timer);
  }, [today]);

  return today;
}

type Ts = { toDate?: () => Date } | null | undefined;
const tsDateStr = (ts: Ts) => (ts?.toDate ? localDateStr(ts.toDate()) : null);

interface MySession {
  key: string;
  title: string;
  detail: string;
  time: string;
  safety: boolean;
}

// Today's sessions from this viewer's own (not-yet-certified) training
// assignments — a personal subset of TodayTrainingsWidget's company-wide list.
export default function TodayMyTrainingsWidget() {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { modules, loading: modulesLoading } = useCompanyTrainingModules(companyId);
  const { assignments, loading: assignmentsLoading } = useMyAssignments();
  const todayStr = useLocalToday();

  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  // Everything of mine happening today: scheduled lessons / practice quiz /
  // final test of modules I'm enrolled in, external (offboard) trainings
  // running today, and assignments due today — mirrors TodayTrainingsWidget,
  // scoped to my own not-yet-finished assignments.
  const todaySessions = useMemo<MySession[]>(() => {
    const mine = assignments.filter((a) => a.status !== 'certified' && a.status !== 'quiz_passed' && a.status !== 'expired');
    const out: MySession[] = [];
    const seenModules = new Set<string>();
    for (const a of mine) {
      const m = moduleById.get(a.moduleId);
      const safety = m ? isSafetyModule(m) : a.trainingType === 'safety_training';
      if (m && !seenModules.has(m.id)) {
        seenModules.add(m.id);
        getModuleSessions(m)
          .filter((s) => s.date === todayStr)
          .forEach((s, i) => out.push({ key: `${m.id}-l${i}`, title: m.title, detail: s.lessonTitle, time: s.time ?? '', safety }));
        if (m.practiceQuiz?.scheduledDate === todayStr) {
          out.push({ key: `${m.id}-pq`, title: m.title, detail: m.practiceQuiz.title || '', time: m.practiceQuiz.scheduledTime ?? '', safety });
        }
        if (m.quiz?.scheduledDate === todayStr) {
          out.push({ key: `${m.id}-q`, title: m.title, detail: m.quiz.title || '', time: m.quiz.scheduledTime ?? '', safety });
        }
      }
      const od = a.offboardDetails;
      const from = tsDateStr(od?.startDate);
      const to = tsDateStr(od?.endDate) ?? from;
      if (from && to && from <= todayStr && todayStr <= to) {
        out.push({ key: `${a.id}-x`, title: a.moduleName, detail: od?.thirdPartyCompany ?? '', time: '', safety });
      }
      if (tsDateStr(a.dueDate) === todayStr) {
        out.push({ key: `${a.id}-d`, title: a.moduleName, detail: t('common.dashboard.trainings.kindDue', { defaultValue: 'Due today' }), time: '', safety });
      }
    }
    return out.sort((x, y) => (x.time || '99:99').localeCompare(y.time || '99:99'));
  }, [assignments, moduleById, todayStr, t]);

  const loading = modulesLoading || assignmentsLoading;

  return (
    <DashboardWidget title={t('common.widgets.todayMyTrainingsWidget.title')} loading={loading} live>
      {todaySessions.length === 0 ? (
        <EmptyState message={t('common.widgets.todayMyTrainingsWidget.empty')} />
      ) : (
        <div className="space-y-1.5">
          {todaySessions.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#F0F4F8]">{s.title}</p>
                <p className="truncate text-[11px] text-[#8BA3BF]">{s.detail}{s.time ? ` · ${s.time}` : ''}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  s.safety ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#1A56DB]/20 text-[#5B8DEF]'
                }`}
              >
                {s.safety ? t('common.widgets.common.safety') : t('common.widgets.common.general')}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
