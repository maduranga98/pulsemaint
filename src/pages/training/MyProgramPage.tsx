import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMyProgramme } from '@/hooks/traineeProgram/useMyProgramme';
import { useProgrammeCertificate } from '@/hooks/traineeProgram/useProgrammeCertificate';
import { useMyAssignments } from '@/hooks/training/useMyAssignments';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  if (!programme) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">My Training Programme</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No training programme has been set up for you yet. Ask your supervisor or plant manager to enroll you.
        </div>
      </div>
    );
  }

  const totalModules = programme.months.reduce((n, m) => n + m.moduleIds.length, 0);
  const completedModules = programme.months.reduce(
    (n, m) => n + m.moduleIds.filter((id) => assignmentByModuleId.get(id)?.status === 'certified').length,
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

      <div className="mt-6">
        <button
          onClick={() => navigate('/app/training/weekend-summary')}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Submit Weekend Summary
        </button>
      </div>
    </div>
  );
}
