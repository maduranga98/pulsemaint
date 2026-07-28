import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Edit2, Archive, Trash2, BookOpen, CalendarRange, MapPin } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTraineeLibraryModules } from '@/hooks/training/useTraineeLibraryModules';
import { sampleTraineeProgrammeModules } from '@/lib/training/sampleModules';
import {
  TRAINEE_TRAINING_TYPE_LABELS,
  TRAINING_DELIVERY_MODE_LABELS,
} from '@/lib/training/trainingTypes';
import type { TraineeTrainingType, TrainingModuleStatus } from '@/lib/training/trainingTypes';
import ModuleStatusBadge from './shared/ModuleStatusBadge';
import { LibraryEmpty, LibraryLoading } from './shared/LibraryStates';

const CAN_AUTHOR_ROLES = ['plant_manager', 'admin', 'hr_officer', 'supervisor'];
const STATUS_FILTERS: { label: string; value: 'all' | TrainingModuleStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
];
const TRAINING_TYPE_OPTIONS = Object.entries(TRAINEE_TRAINING_TYPE_LABELS) as [TraineeTrainingType, string][];

/**
 * Trainee Management's module library — programme oriented.
 *
 * Entirely independent of the Training tab's `TrainingModuleLibrary`: its
 * own hook (`useTraineeLibraryModules`), its own toolbar and filters, its
 * own table showing programme fields (training type / mode / default
 * period), its own editor routes (`training/manage/trainee-modules/*`), and
 * its own sample seeder.
 *
 * Deliberately has no per-module Assign action: assignment here stays
 * trainee-first through AssignTrainingWizard, which reads only this library.
 */
export default function TraineeModuleLibrary({ title = 'Trainee Module Library' }: { title?: string }) {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.userProfile?.role);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const canAuthor = !!role && CAN_AUTHOR_ROLES.includes(role);
  // Matches the firestore.rules delete rule for trainingModules — admin only.
  const canDelete = role === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TrainingModuleStatus>('all');
  const [typeFilter, setTypeFilter] = useState<TraineeTrainingType | ''>('');
  const [seeding, setSeeding] = useState(false);

  const { modules, loading } = useTraineeLibraryModules();

  const filtered = useMemo(
    () =>
      modules.filter((m) => {
        const term = search.trim().toLowerCase();
        const matchesSearch = term === '' || (m.title ?? '').toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
        const matchesType = typeFilter === '' || m.trainingType === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [modules, search, statusFilter, typeFilter]
  );

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this module? It will no longer be assignable to trainees.')) return;
    await updateDoc(doc(db, 'trainingModules', id), { status: 'archived', updatedAt: serverTimestamp() });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this module permanently? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'trainingModules', id));
  };

  const handleLoadSamples = async () => {
    if (!companyId || !userId) return;
    setSeeding(true);
    try {
      for (const sample of sampleTraineeProgrammeModules()) {
        const { quiz: practiceQuiz, finalTest, ...rest } = sample;
        await addDoc(collection(db, 'trainingModules'), {
          ...rest,
          quiz: finalTest,
          practiceQuiz,
          companyId,
          createdBy: userId,
          status: 'active',
          libraryScope: 'trainee_management',
          machineId: null,
          machineTypeId: null,
          coverImageUrl: '',
          version: 1,
          prerequisiteModuleIds: [],
          usageCount: 0,
          completionCount: 0,
          updatedBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } finally {
      setSeeding(false);
    }
  };

  const typeLabel = (t?: TraineeTrainingType) => (t ? TRAINEE_TRAINING_TYPE_LABELS[t] ?? t : '—');
  const modeLabel = (m?: 'online' | 'onsite') => (m ? TRAINING_DELIVERY_MODE_LABELS[m] ?? m : '—');
  const periodLabel = (months?: number) => (months ? `${months} months` : '—');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
        {canAuthor && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleLoadSamples()}
              disabled={seeding}
              className="flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Sparkles size={16} /> {seeding ? 'Loading…' : 'Load Sample Modules'}
            </button>
            <button
              onClick={() => navigate('/app/training/manage/trainee-modules/new')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} /> Create Trainee Module
            </button>
          </div>
        )}
      </div>

      {/* Filter bar — status and training type, the two axes that matter for
          a trainee programme. */}
      <div className="flex flex-col lg:flex-row gap-3">
        <input
          type="text"
          placeholder="Search trainee modules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TraineeTrainingType | '')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-56"
        >
          <option value="">All training types</option>
          {TRAINING_TYPE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setStatusFilter(btn.value)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                statusFilter === btn.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <LibraryLoading />
        ) : filtered.length === 0 ? (
          <LibraryEmpty message="No trainee modules found." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Training Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mode</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Default Period</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Lessons</th>
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
                  <td className="px-4 py-3 text-gray-600">{typeLabel(module.trainingType)}</td>
                  <td className="px-4 py-3 text-gray-600">{modeLabel(module.trainingMode)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {periodLabel(module.defaultTrainingPeriodMonths)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{module.lessons?.length ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <ModuleStatusBadge status={module.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canAuthor && (
                        <button
                          onClick={() => navigate(`/app/training/manage/trainee-modules/${module.id}`)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                      {canAuthor && module.status !== 'archived' && (
                        <button
                          onClick={() => void handleArchive(module.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded hover:bg-gray-200 transition-colors"
                        >
                          <Archive className="w-3 h-3" />
                          Archive
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => void handleDelete(module.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <LibraryLoading />
        ) : filtered.length === 0 ? (
          <LibraryEmpty message="No trainee modules found." />
        ) : (
          filtered.map((module) => (
            <div key={module.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{module.title}</p>
                  <p className="text-sm text-gray-500 truncate">{typeLabel(module.trainingType)}</p>
                </div>
                <ModuleStatusBadge status={module.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {modeLabel(module.trainingMode)}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarRange className="w-3.5 h-3.5" />
                  {periodLabel(module.defaultTrainingPeriodMonths)}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {module.lessons?.length ?? 0} lessons
                </span>
              </div>
              <div className="flex gap-2">
                {canAuthor && (
                  <button
                    onClick={() => navigate(`/app/training/manage/trainee-modules/${module.id}`)}
                    className="flex-1 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => void handleDelete(module.id)}
                    className="flex-1 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Delete
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
