import { useMemo } from 'react';
import { ShieldAlert, CalendarClock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  getModuleSessions,
  isSafetyAssignment,
  useSafetyTrainingModules,
} from '@/hooks/training/useSafetyTrainings';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';

function formatDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The signed-in learner's own Safety Training — the safety modules assigned to
 * them, plus a schedule of their upcoming scheduled sessions. Schedules live on
 * the module's lessons, so it joins the learner's assignments to the company's
 * Safety Training modules.
 */
export default function MySafetyTrainings({ assignments }: { assignments: TrainingAssignment[] }) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { modulesById, moduleIds } = useSafetyTrainingModules(companyId);

  const safetyAssignments = useMemo(
    () => assignments.filter((a) => isSafetyAssignment(a, moduleIds, a.moduleId)),
    [assignments, moduleIds],
  );

  const today = new Date().toISOString().slice(0, 10);

  // Upcoming scheduled sessions (today onward) for the learner's assigned
  // safety modules, soonest first.
  const upcoming = useMemo(() => {
    const sessions = safetyAssignments.flatMap((a) => {
      const mod = modulesById.get(a.moduleId);
      return mod ? getModuleSessions(mod) : [];
    });
    return sessions
      .filter((s) => s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .slice(0, 6);
  }, [safetyAssignments, modulesById, today]);

  if (safetyAssignments.length === 0) return null;

  const outstanding = safetyAssignments.filter((a) => a.status !== 'certified').length;

  return (
    <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold text-slate-900">My Safety Training</h2>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-center">
          <div className="text-xl font-bold text-slate-900">{safetyAssignments.length}</div>
          <div className="text-xs text-slate-500">Assigned</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-center">
          <div className="text-xl font-bold text-amber-700">{outstanding}</div>
          <div className="text-xs text-slate-500">Outstanding</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-center">
          <div className="text-xl font-bold text-slate-900">{upcoming.length}</div>
          <div className="text-xs text-slate-500">Upcoming sessions</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Assigned modules</h3>
          <div className="space-y-2">
            {safetyAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">{a.moduleName}</span>
                <TrainingStatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <CalendarClock className="h-4 w-4 text-amber-600" /> My schedule
          </h3>
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-amber-100 bg-white px-3 py-2.5 text-sm text-slate-500">
              No upcoming safety-training sessions scheduled.
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((s, i) => (
                <div key={i} className="rounded-lg border border-amber-100 bg-white px-3 py-2.5">
                  <p className="text-sm font-medium text-slate-800">{s.moduleTitle}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(s.date)}
                    {s.time ? ` · ${s.time}` : ''}
                    {s.lessonTitle ? ` · ${s.lessonTitle}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
