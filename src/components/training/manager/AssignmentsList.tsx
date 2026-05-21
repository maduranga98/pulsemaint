import { useState } from 'react';
import type { TrainingAssignment, AssignmentStatus } from '@/lib/training/trainingTypes';
import type { Timestamp } from 'firebase/firestore';
import { Eye } from 'lucide-react';

interface AssignmentsListProps {
  assignments: TrainingAssignment[];
  loading: boolean;
  onViewProgress?: (id: string) => void;
}

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const date = new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'Not Started', value: 'not_started' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Quiz Passed', value: 'quiz_passed' },
  { label: 'Quiz Failed', value: 'quiz_failed' },
  { label: 'Awaiting Sign-Off', value: 'awaiting_practical' },
  { label: 'Certified', value: 'certified' },
  { label: 'Expired', value: 'expired' },
  { label: 'Retraining', value: 'retraining_required' },
];

export default function AssignmentsList({
  assignments,
  loading,
  onViewProgress,
}: AssignmentsListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const departments = Array.from(
    new Set(assignments.map((a) => a.department).filter(Boolean))
  ).sort();

  const filtered = assignments.filter((a) => {
    const matchSearch =
      !search.trim() ||
      a.traineeName.toLowerCase().includes(search.toLowerCase()) ||
      a.moduleName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchDept = !deptFilter || a.department === deptFilter;
    return matchSearch && matchStatus && matchDept;
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
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search trainee or module..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No assignments found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trainee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Module</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Machine</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Assigned</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Progress</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.traineeName}</p>
                    <p className="text-xs text-gray-500">{a.department}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.moduleName}</td>
                  <td className="px-4 py-3 text-gray-600">{a.machineName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{formatTs(a.assignedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatTs(a.dueDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-24">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${a.overallProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {a.overallProgress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onViewProgress && (
                      <button
                        onClick={() => onViewProgress(a.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            No assignments found.
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {a.traineeName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{a.moduleName}</p>
                  <p className="text-xs text-gray-400">{a.department}</p>
                </div>
                <span
                  className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[a.status]}`}
                >
                  {STATUS_LABEL[a.status]}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{a.overallProgress}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${a.overallProgress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Due: {formatTs(a.dueDate)}</span>
                {onViewProgress && (
                  <button
                    onClick={() => onViewProgress(a.id)}
                    className="flex items-center gap-1 text-blue-600 font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
