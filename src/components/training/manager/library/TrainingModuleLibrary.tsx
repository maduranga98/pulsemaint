import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Edit2, Trash2, BookOpen, HelpCircle, Globe2, UserPlus } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTrainingLibraryModules } from '@/hooks/training/useTrainingLibraryModules';
import { useModuleAssignmentCounts } from '@/hooks/training/useModuleAssignmentCounts';
import { sampleTrainingLibraryModules } from '@/lib/training/sampleModules';
import { getModuleCategory, isOffboardModule } from '@/lib/training/offboardTraining';
import {
  TRAINEE_TRAINING_TYPE_LABELS,
  TRAINING_DELIVERY_MODE_LABELS,
  SAFETY_TRAINING_TYPE,
} from '@/lib/training/trainingTypes';
import type {
  TraineeTrainingType,
  TrainingDeliveryMode,
  TrainingLibraryModule,
  TrainingModuleCategory,
} from '@/lib/training/trainingTypes';
import ModuleAssignForm from '../ModuleAssignForm';
import ModuleStatusBadge from './shared/ModuleStatusBadge';
import { LibraryEmpty, LibraryLoading } from './shared/LibraryStates';

const CAN_AUTHOR_ROLES = ['plant_manager', 'admin', 'hr_officer', 'supervisor', 'safety_officer'];
// Safety Training modules live exclusively on the Safety Trainings page —
// excluded here so they aren't creatable/visible from the general library.
const TRAINING_TYPE_OPTIONS = (Object.entries(TRAINEE_TRAINING_TYPE_LABELS) as [TraineeTrainingType, string][])
  .filter(([value]) => value !== SAFETY_TRAINING_TYPE);
const MODE_OPTIONS = Object.entries(TRAINING_DELIVERY_MODE_LABELS) as [TrainingDeliveryMode, string][];
const CATEGORY_OPTIONS: [TrainingModuleCategory, string][] = [
  ['machine', 'Machine'],
  ['offboard', 'External'],
];

/**
 * The Training tab's module library — machine/competency oriented.
 *
 * Entirely independent of Trainee Management's `TraineeModuleLibrary`: its
 * own hook (`useTrainingLibraryModules`), its own toolbar and filters, its
 * own table, its own editor routes (`training/manage/modules/*`), and its
 * own sample seeder. Nothing here branches on "which library am I".
 */
const CATEGORY_LABELS: Record<'machine' | 'offboard', string> = {
  machine: 'Machine',
  offboard: 'External',
};

export default function TrainingModuleLibrary({
  title = 'Module Library',
  hideHeaderActions = false,
}: {
  title?: string;
  hideHeaderActions?: boolean;
}) {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.userProfile?.role);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const canAuthor = !!role && CAN_AUTHOR_ROLES.includes(role);
  // Matches the firestore.rules delete rule for trainingModules — admin only.
  const canDelete = role === 'admin';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TraineeTrainingType | ''>('');
  const [modeFilter, setModeFilter] = useState<TrainingDeliveryMode | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<TrainingModuleCategory | ''>('');
  const [seeding, setSeeding] = useState(false);
  const [assigningModule, setAssigningModule] = useState<TrainingLibraryModule | null>(null);

  const { modules, loading } = useTrainingLibraryModules();
  const { counts: assignmentCounts } = useModuleAssignmentCounts();

  const filtered = useMemo(
    () =>
      modules.filter((m) => {
        // Safety Training modules belong only on the Safety Trainings page.
        if (m.trainingType === SAFETY_TRAINING_TYPE) return false;
        const term = search.trim().toLowerCase();
        const matchesSearch = term === '' || (m.title ?? '').toLowerCase().includes(term);
        const matchesType = typeFilter === '' || m.trainingType === typeFilter;
        const matchesMode = modeFilter === '' || m.trainingMode === modeFilter;
        const matchesCategory = categoryFilter === '' || getModuleCategory(m) === categoryFilter;
        return matchesSearch && matchesType && matchesMode && matchesCategory;
      }),
    [modules, search, typeFilter, modeFilter, categoryFilter]
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this module permanently? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'trainingModules', id));
  };

  const handleLoadSamples = async () => {
    if (!companyId || !userId) return;
    setSeeding(true);
    try {
      for (const sample of sampleTrainingLibraryModules()) {
        const { quiz: practiceQuiz, finalTest, ...rest } = sample;
        await addDoc(collection(db, 'trainingModules'), {
          ...rest,
          quiz: finalTest,
          practiceQuiz,
          companyId,
          createdBy: userId,
          status: 'active',
          libraryScope: 'training',
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

  const assignedOf = (id: string) => assignmentCounts[id]?.assigned ?? 0;
  const completedOf = (id: string) => assignmentCounts[id]?.completed ?? 0;
  const typeLabel = (t?: TraineeTrainingType) => (t ? TRAINEE_TRAINING_TYPE_LABELS[t] ?? t : '—');
  const modeLabel = (m?: TrainingDeliveryMode) => (m ? TRAINING_DELIVERY_MODE_LABELS[m] ?? m : '—');

  return (
    <div className="space-y-4">
      {!hideHeaderActions && (
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
                onClick={() => navigate('/app/training/manage/modules/new')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={16} /> Create Training Module
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter bar — search plus Mode / Type / Category filters. */}
      <div className="flex flex-col lg:flex-row gap-3">
        <input
          type="text"
          placeholder="Search modules by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value as TrainingDeliveryMode | '')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-40"
        >
          <option value="">All modes</option>
          {MODE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as TrainingModuleCategory | '')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-40"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <LibraryLoading />
        ) : filtered.length === 0 ? (
          <LibraryEmpty />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Training Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mode</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
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
                  <td className="px-4 py-3 text-gray-600">
                    {typeLabel(module.trainingType)}
                    {isOffboardModule(module) && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-purple-500">
                        <Globe2 className="w-3 h-3" />
                        {module.offboardDetails?.thirdPartyCompany || 'External provider'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{modeLabel(module.trainingMode)}</td>
                  <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[getModuleCategory(module)]}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{module.lessons?.length ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    {module.quiz ? (
                      <span className="text-green-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {/* Live tally from trainingAssignments — the module doc's
                        usageCount was never written to and always read 0. */}
                    <span className="font-medium text-gray-900">{assignedOf(module.id)}</span>
                    {assignedOf(module.id) > 0 && (
                      <span className="block text-[11px] text-gray-400">{completedOf(module.id)} completed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ModuleStatusBadge status={module.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canAuthor && module.status === 'active' && (
                        <button
                          onClick={() => setAssigningModule(module)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          <UserPlus className="w-3 h-3" />
                          Assign
                        </button>
                      )}
                      {canAuthor && (
                        <button
                          onClick={() => navigate(`/app/training/manage/modules/${module.id}`)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
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
          <LibraryEmpty />
        ) : (
          filtered.map((module) => (
            <div key={module.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{module.title}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {typeLabel(module.trainingType)} · {modeLabel(module.trainingMode)}
                    {isOffboardModule(module) &&
                      ` · ${module.offboardDetails?.thirdPartyCompany || 'External provider'}`}
                  </p>
                </div>
                <ModuleStatusBadge status={module.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {module.lessons?.length ?? 0} lessons
                </span>
                {module.quiz && (
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Has quiz
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" />
                  {assignedOf(module.id)} assigned
                  {assignedOf(module.id) > 0 && ` · ${completedOf(module.id)} completed`}
                </span>
              </div>
              <div className="flex gap-2">
                {canAuthor && module.status === 'active' && (
                  <button
                    onClick={() => setAssigningModule(module)}
                    className="flex-1 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Assign
                  </button>
                )}
                {canAuthor && (
                  <button
                    onClick={() => navigate(`/app/training/manage/modules/${module.id}`)}
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

      {assigningModule && (
        <ModuleAssignForm
          module={assigningModule}
          onClose={() => setAssigningModule(null)}
          onAssigned={() => setAssigningModule(null)}
        />
      )}
    </div>
  );
}
