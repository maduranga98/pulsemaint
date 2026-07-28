import { useState } from 'react';
import { ChevronDown, Mail, Phone, MapPin, Wrench, FileText } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import type { TrainingAssignment, AssignmentStatus } from '@/lib/training/trainingTypes';
import type { UserProfile } from '@/types/auth';
import { isOffboardAssignment } from '@/lib/training/offboardTraining';

interface TraineeManagementListProps {
  trainees: UserProfile[];
  assignments: TrainingAssignment[];
  woCounts: Record<string, number>;
  loading: boolean;
  onViewOffboardReport?: (assignment: TrainingAssignment) => void;
}

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const date = new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  quiz_passed: 'Quiz Passed',
  quiz_failed: 'Quiz Failed',
  awaiting_practical: 'Awaiting Sign-Off',
  certified: 'Certified',
  expired: 'Expired',
  retraining_required: 'Retraining',
};

const STATUS_CLASSES: Record<AssignmentStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  quiz_passed: 'bg-teal-100 text-teal-700',
  quiz_failed: 'bg-red-100 text-red-700',
  awaiting_practical: 'bg-amber-100 text-amber-700',
  certified: 'bg-green-100 text-green-700',
  expired: 'bg-gray-200 text-gray-500',
  retraining_required: 'bg-orange-100 text-orange-700',
};

export default function TraineeManagementList({
  trainees,
  assignments,
  woCounts,
  loading,
  onViewOffboardReport,
}: TraineeManagementListProps) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = trainees.filter((t) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      t.fullName.toLowerCase().includes(term) ||
      (t.department ?? '').toLowerCase().includes(term) ||
      (t.employeeId ?? '').toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search trainee by name, department, or employee ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
            No trainees found.
          </div>
        ) : (
          filtered.map((trainee) => {
            const traineeAssignments = assignments.filter((a) => a.traineeId === trainee.id);
            const avgProgress = traineeAssignments.length
              ? Math.round(
                  traineeAssignments.reduce((sum, a) => sum + (a.overallProgress ?? 0), 0) /
                    traineeAssignments.length
                )
              : 0;
            const isOpen = expandedId === trainee.id;

            return (
              <div key={trainee.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : trainee.id)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold flex-shrink-0">
                      {trainee.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{trainee.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {trainee.employeeId ?? '—'} &middot; {trainee.department ?? 'No department'} &middot;{' '}
                        {trainee.jobTitle ?? trainee.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                    <span>{traineeAssignments.length} training{traineeAssignments.length !== 1 ? 's' : ''}</span>
                    <span>{avgProgress}% avg progress</span>
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> {woCounts[trainee.id] ?? 0} WOs joined
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Profile details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-gray-400" /> {trainee.email ?? '—'}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400" /> {trainee.phone ?? '—'}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" /> {trainee.address ?? '—'}
                      </div>
                    </div>

                    {/* Assigned trainings */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Assigned Trainings
                      </h4>
                      {traineeAssignments.length === 0 ? (
                        <p className="text-sm text-gray-400">No trainings assigned yet.</p>
                      ) : (
                        <div className="border border-gray-200 rounded-lg overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Module</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Period</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Progress</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Marks</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {traineeAssignments.map((a) => (
                                <tr key={a.id}>
                                  <td className="px-3 py-2 text-gray-800">{a.moduleName}</td>
                                  <td className="px-3 py-2 text-gray-600">
                                    {a.trainingPeriodMonths ? `${a.trainingPeriodMonths} months` : '—'}
                                    <div className="text-[11px] text-gray-400">
                                      {formatTs(a.assignedAt)} → {formatTs(a.dueDate)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-20">
                                        <div
                                          className="h-full bg-blue-500 rounded-full"
                                          style={{ width: `${a.overallProgress}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500">{a.overallProgress}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    {(a.attemptsUsed ?? 0) > 0 ? (
                                      <span
                                        className={`text-xs font-semibold ${
                                          a.quizPassed ? 'text-emerald-600' : 'text-amber-600'
                                        }`}
                                      >
                                        {a.bestScore ?? 0}%
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[a.status]}`}
                                    >
                                      {STATUS_LABEL[a.status]}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {isOffboardAssignment(a) && onViewOffboardReport && (
                                      <button
                                        onClick={() => onViewOffboardReport(a)}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
                                      >
                                        <FileText className="w-3 h-3" />
                                        Report
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
