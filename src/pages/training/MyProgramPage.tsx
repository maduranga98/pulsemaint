import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMyProgramme } from '@/hooks/traineeProgram/useMyProgramme';
import { useProgrammeCertificate } from '@/hooks/traineeProgram/useProgrammeCertificate';
import { useMyAssignments } from '@/hooks/training/useMyAssignments';
import { useTraineeLibraryModules } from '@/hooks/training/useTraineeLibraryModules';
import TrainingProgressBar from '@/components/training/shared/TrainingProgressBar';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MyProgramPage() {
  const navigate = useNavigate();
  const { programme, loading } = useMyProgramme();
  const { assignments } = useMyAssignments();
  const { certificate } = useProgrammeCertificate(programme?.certificateId ?? null);

  const assignmentByModuleId = new Map<string, TrainingAssignment>();
  for (const a of assignments) assignmentByModuleId.set(a.moduleId, a);

  // Everything assigned to this trainee out of the Trainee Management module
  // library. A programme groups a subset of these into months, but plenty of
  // trainees are assigned modules without a formal programme ever being set
  // up — those used to be invisible on this page entirely.
  const { modules: traineeModules } = useTraineeLibraryModules();
  const traineeModuleIds = new Set(traineeModules.map((m) => m.id));
  // Only what's still outstanding — completed ones (quiz passed or signed
  // off) have nothing left to do and are covered by My Certificates instead.
  const traineeAssignments = assignments.filter(
    (a) => traineeModuleIds.has(a.moduleId) && a.status !== 'quiz_passed' && a.status !== 'certified',
  );

  const assignedModulesSection = (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900 mb-3">Assigned Trainee Modules</h2>
      {traineeAssignments.length === 0 ? (
        <p className="text-sm text-slate-500">No trainee modules outstanding — nothing new assigned, or everything assigned is already complete.</p>
      ) : (
        <div className="space-y-2">
          {traineeAssignments.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/app/training/my-modules/${a.id}`)}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:border-blue-300 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 truncate">{a.moduleName}</span>
                <span className="block text-xs text-slate-500">
                  Assigned {formatDate(a.assignedAt)}
                  {a.dueDate ? ` · due ${formatDate(a.dueDate)}` : ''}
                </span>
              </span>
              <TrainingStatusBadge status={a.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  if (!programme) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Training Programme</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          No month-by-month programme has been set up for you yet — the trainee modules assigned to you are below.
        </div>
        {assignedModulesSection}
      </div>
    );
  }

  const totalModules = programme.months.reduce((n, m) => n + m.moduleIds.length, 0);
  // A programme module counts as complete once its final test is passed —
  // programme modules aren't certified one-by-one (that would mint a per-module
  // certificate); the single certificate is issued at programme completion.
  const isModuleDone = (id: string) => {
    const a = assignmentByModuleId.get(id);
    return !!a && (a.quizPassed === true || a.status === 'quiz_passed' || a.status === 'certified');
  };
  const completedModules = programme.months.reduce(
    (n, m) => n + m.moduleIds.filter(isModuleDone).length,
    0,
  );
  const overallPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Training Programme</h1>
        <p className="mt-1 text-slate-600">
          {programme.durationMonths}-month programme · started {formatDate(programme.startDate)} · expected completion {formatDate(programme.expectedEndDate)}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Overall Progress</span>
          <span className="text-sm font-semibold text-slate-900">{completedModules} / {totalModules} modules</span>
        </div>
        <TrainingProgressBar progress={overallPercent} showLabel />
        {programme.status === 'completed' && (
          <p className="mt-3 text-sm font-medium text-green-700">
            Programme completed{programme.finalMark != null ? ` — final mark ${programme.finalMark}%` : ''}.{' '}
            {certificate?.pdfUrl && (
              <a href={certificate.pdfUrl} target="_blank" rel="noreferrer" className="underline">
                Download certificate
              </a>
            )}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {programme.months.map((m) => {
          const monthModules = m.moduleIds.map((id) => assignmentByModuleId.get(id)).filter(Boolean) as TrainingAssignment[];
          return (
            <div key={m.month} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-900">Month {m.month}{m.title ? ` — ${m.title}` : ''}</h2>
              </div>
              {monthModules.length === 0 ? (
                <p className="text-sm text-slate-500">No modules assigned for this month yet.</p>
              ) : (
                <div className="space-y-2">
                  {monthModules.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/app/training/my-modules/${a.id}`)}
                      className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:border-blue-300 transition-colors"
                    >
                      <span className="text-sm font-medium text-slate-800 truncate">{a.moduleName}</span>
                      <TrainingStatusBadge status={a.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
