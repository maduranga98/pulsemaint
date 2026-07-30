import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Wrench, FileText, BookOpen, TrendingUp, Award, CalendarRange } from 'lucide-react';
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
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selectedTrainee = selectedId ? trainees.find((t) => t.id === selectedId) ?? null : null;
  const selectedAssignments = selectedId ? assignments.filter((a) => a.traineeId === selectedId) : [];

  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="Search trainee by name, department, or employee ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Trainee profile analytics — a card per trainee, not a plain list */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Trainee Profiles
        </h2>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
            No trainees found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((trainee) => {
              const traineeAssignments = assignments.filter((a) => a.traineeId === trainee.id);
              const avgProgress = traineeAssignments.length
                ? Math.round(
                    traineeAssignments.reduce((sum, a) => sum + (a.overallProgress ?? 0), 0) /
                      traineeAssignments.length
                  )
                : 0;
              const scored = traineeAssignments.filter((a) => (a.attemptsUsed ?? 0) > 0);
              const avgMarks = scored.length
                ? Math.round(scored.reduce((sum, a) => sum + (a.bestScore ?? 0), 0) / scored.length)
                : null;
              const isSelected = selectedId === trainee.id;

              return (
                <button
                  key={trainee.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : trainee.id)}
                  className={`text-left bg-white rounded-xl border p-4 space-y-3 transition-colors ${
                    isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold flex-shrink-0">
                      {trainee.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{trainee.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {trainee.employeeId ?? '—'} &middot; {trainee.department ?? 'No department'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg py-2">
                      <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                        <BookOpen className="w-3 h-3 text-gray-400" /> {traineeAssignments.length}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Trainings</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-2">
                      <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3 text-gray-400" /> {avgProgress}%
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Progress</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-2">
                      <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                        <Award className="w-3 h-3 text-gray-400" /> {avgMarks ?? '—'}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Marks</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> {woCounts[trainee.id] ?? 0} WOs joined
                    </span>
                    <span className="text-blue-600 font-medium">{isSelected ? 'Hide trainings' : 'View trainings'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Trainings — shown only for the selected trainee, without repeating
          their profile info (already shown above). */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Trainings{selectedTrainee ? ` — ${selectedTrainee.fullName}` : ''}
        </h2>
        {!selectedTrainee ? (
          <div className="py-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
            Select a trainee above to view their assigned trainings.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs flex-1 min-w-0">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> {selectedTrainee.email ?? '—'}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> {selectedTrainee.phone ?? '—'}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> {selectedTrainee.address ?? '—'}
                </div>
              </div>
              {/* Set up / manage the trainee's month-by-month training
                  programme (the "My Program" view the trainee sees). */}
              <button
                type="button"
                onClick={() => navigate(`/app/training/manage/trainees/${selectedTrainee.id}/programme`)}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                Set up Training Programme
              </button>
            </div>

            {selectedAssignments.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
                No trainings assigned yet.
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
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
                    {selectedAssignments.map((a) => (
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
        )}
      </div>
    </div>
  );
}
