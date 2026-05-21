import { useState } from 'react';
import { Edit2, UserPlus, Archive, BookOpen, HelpCircle, Layers } from 'lucide-react';
import type { TrainingModule, TrainingModuleStatus } from '@/lib/training/trainingTypes';

interface ModuleLibraryListProps {
  modules: TrainingModule[];
  loading: boolean;
  onEdit: (id: string) => void;
  onAssign: (id: string) => void;
  onArchive: (id: string) => void;
}

type StatusFilter = 'all' | TrainingModuleStatus;

const STATUS_BADGE: Record<TrainingModuleStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<TrainingModuleStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

export default function ModuleLibraryList({
  modules,
  loading,
  onEdit,
  onAssign,
  onArchive,
}: ModuleLibraryListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = modules.filter((m) => {
    const matchesSearch =
      search.trim() === '' ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.machineName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
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
          placeholder="Search modules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setStatusFilter(btn.value)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                statusFilter === btn.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Layers className="w-10 h-10 mb-2" />
            <p className="text-sm">No modules found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Machine</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Lessons</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Has Quiz</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Assigned</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((module) => (
                <tr key={module.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{module.title}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{module.machineName || '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{module.lessons.length}</td>
                  <td className="px-4 py-3 text-center">
                    {module.quiz ? (
                      <span className="text-green-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{module.usageCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[module.status]}`}
                    >
                      {STATUS_LABEL[module.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(module.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => onAssign(module.id)}
                        disabled={module.status !== 'active'}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <UserPlus className="w-3 h-3" />
                        Assign
                      </button>
                      {module.status !== 'archived' && (
                        <button
                          onClick={() => onArchive(module.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded hover:bg-gray-200 transition-colors"
                        >
                          <Archive className="w-3 h-3" />
                          Archive
                        </button>
                      )}
                    </div>
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
          <div className="flex flex-col items-center py-12 text-gray-400">
            <Layers className="w-10 h-10 mb-2" />
            <p className="text-sm">No modules found.</p>
          </div>
        ) : (
          filtered.map((module) => (
            <div
              key={module.id}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{module.title}</p>
                  <p className="text-sm text-gray-500 truncate">{module.machineName || 'No machine'}</p>
                </div>
                <span
                  className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[module.status]}`}
                >
                  {STATUS_LABEL[module.status]}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {module.lessons.length} lessons
                </span>
                {module.quiz && (
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Has quiz
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(module.id)}
                  className="flex-1 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onAssign(module.id)}
                  disabled={module.status !== 'active'}
                  className="flex-1 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
