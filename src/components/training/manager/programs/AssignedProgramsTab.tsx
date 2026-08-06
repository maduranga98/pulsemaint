import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Award } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useAuthStore } from '@/store/authStore';
import { useProgramAssignments } from '@/hooks/training/useProgramAssignments';
import { signOffProgramAssignment } from '@/services/trainingProgram.service';
import type { ProgramAssignment } from '@/types/trainingProgram';
import CertificateView from './CertificateView';

function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return (ts as unknown as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AssignedProgramsTab() {
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const userRole = useAuthStore((s) => s.userProfile?.role) ?? '';
  const { programAssignments, moduleAssignmentsById, loading } = useProgramAssignments();

  const [signingOff, setSigningOff] = useState<ProgramAssignment | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewingCert, setViewingCert] = useState<ProgramAssignment | null>(null);

  const rows = useMemo(() => {
    return programAssignments.map((pa) => {
      const moduleAssignments = pa.moduleAssignmentIds.map((id) => moduleAssignmentsById.get(id)).filter(Boolean);
      const total = moduleAssignments.length || 1;
      const progress = Math.round(
        moduleAssignments.reduce((sum, a) => sum + (a?.overallProgress ?? 0), 0) / total
      );
      const allDone = moduleAssignments.length > 0 && moduleAssignments.every((a) => (a?.overallProgress ?? 0) >= 100);
      return { pa, progress, allDone, moduleAssignments };
    });
  }, [programAssignments, moduleAssignmentsById]);

  const openRows = rows.filter((r) => r.pa.status !== 'signed_off');
  const signedOffRows = rows.filter((r) => r.pa.status === 'signed_off');

  const handleConfirmSignOff = async () => {
    if (!signingOff) return;
    const row = rows.find((r) => r.pa.id === signingOff.id);
    setSaving(true);
    try {
      const moduleResults = (row?.moduleAssignments ?? [])
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => ({ moduleId: a.moduleId, moduleName: a.moduleName, score: a.bestScore ?? 0 }));
      await signOffProgramAssignment(signingOff.id, note, userId, userName, userRole, moduleResults);
      setSigningOff(null);
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {openRows.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <ClipboardList className="w-8 h-8 mb-2" />
            <p className="text-sm">No one has an open program assignment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Program</th>
                  <th className="px-4 py-3 text-left">Trainee</th>
                  <th className="px-4 py-3 text-left">Assigned</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-left">Progress</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {openRows.map(({ pa, progress, allDone }) => (
                  <tr key={pa.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{pa.programName}</td>
                    <td className="px-4 py-3 text-gray-700">{pa.traineeName}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(pa.assignedAt)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(pa.dueDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          allDone ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {allDone ? 'Awaiting Sign-Off' : 'In Progress'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {allDone && (
                        <button
                          onClick={() => setSigningOff(pa)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sign Off
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {signedOffRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Signed Off</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {signedOffRows.map(({ pa }) => (
              <div key={pa.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{pa.traineeName}</p>
                  <p className="text-xs text-gray-500">{pa.programName}</p>
                </div>
                <button
                  onClick={() => setViewingCert(pa)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <Award className="w-3.5 h-3.5" /> View Certificate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {signingOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Sign Off Program</h3>
              <p className="text-sm text-gray-500 mt-1">
                {signingOff.traineeName} — {signingOff.programName}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Sign-off note..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSigningOff(null);
                  setNote('');
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmSignOff()}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {saving ? 'Signing off…' : 'Confirm Sign Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingCert && <CertificateView programAssignment={viewingCert} onClose={() => setViewingCert(null)} />}
    </div>
  );
}
