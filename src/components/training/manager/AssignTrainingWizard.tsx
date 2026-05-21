import { useState } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTraineeList } from '@/hooks/training/useTraineeList';
import { useTrainingModules } from '@/hooks/training/useTrainingModules';
import type { UserProfile } from '@/types/auth';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import {
  Users,
  BookOpen,
  Settings,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Search,
  Clock,
  Loader2,
} from 'lucide-react';

interface AssignTrainingWizardProps {
  defaultModuleId?: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface AssignmentSettings {
  dueDate: string;
  isRetraining: boolean;
  retrainingReason: string;
  notifyTrainee: boolean;
}

const STEPS = [
  { label: 'Select Trainees', icon: Users },
  { label: 'Select Modules', icon: BookOpen },
  { label: 'Settings', icon: Settings },
  { label: 'Review & Confirm', icon: CheckCircle },
];

export default function AssignTrainingWizard({
  defaultModuleId,
  onComplete,
  onCancel,
}: AssignTrainingWizardProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';

  const [step, setStep] = useState(0);
  const [traineeSearch, setTraineeSearch] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedTrainees, setSelectedTrainees] = useState<UserProfile[]>([]);
  const [selectedModules, setSelectedModules] = useState<TrainingModule[]>(
    []
  );
  const [settings, setSettings] = useState<AssignmentSettings>({
    dueDate: '',
    isRetraining: false,
    retrainingReason: '',
    notifyTrainee: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [done, setDone] = useState(false);

  const { trainees, loading: traineesLoading } = useTraineeList({
    searchQuery: traineeSearch,
  });
  const { modules, loading: modulesLoading } = useTrainingModules({
    status: 'active',
  });

  // Pre-select defaultModuleId once modules load
  const filteredModules = moduleSearch.trim()
    ? modules.filter(
        (m) =>
          m.title.toLowerCase().includes(moduleSearch.toLowerCase()) ||
          m.machineName.toLowerCase().includes(moduleSearch.toLowerCase())
      )
    : modules;

  function toggleTrainee(trainee: UserProfile) {
    setSelectedTrainees((prev) =>
      prev.find((t) => t.id === trainee.id)
        ? prev.filter((t) => t.id !== trainee.id)
        : [...prev, trainee]
    );
  }

  function toggleModule(mod: TrainingModule) {
    setSelectedModules((prev) => {
      if (prev.find((m) => m.id === mod.id)) {
        return prev.filter((m) => m.id !== mod.id);
      }
      // Pre-select defaultModuleId
      if (defaultModuleId && mod.id === defaultModuleId && prev.length === 0) {
        return [mod];
      }
      return [...prev, mod];
    });
  }

  // Ensure defaultModuleId gets pre-selected when step 1 is first shown
  function handleStepChange(next: number) {
    if (next === 1 && defaultModuleId && selectedModules.length === 0) {
      const def = modules.find((m) => m.id === defaultModuleId);
      if (def) setSelectedModules([def]);
    }
    setStep(next);
  }

  function selectAllTrainees() {
    if (selectedTrainees.length === trainees.length) {
      setSelectedTrainees([]);
    } else {
      setSelectedTrainees([...trainees]);
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      let skipped = 0;
      const pairs: { trainee: UserProfile; module: TrainingModule }[] = [];

      for (const trainee of selectedTrainees) {
        for (const mod of selectedModules) {
          pairs.push({ trainee, module: mod });
        }
      }

      for (const { trainee, module } of pairs) {
        // Check if assignment already exists (non-certified)
        const existingSnap = await getDocs(
          query(
            collection(db, 'trainingAssignments'),
            where('companyId', '==', companyId),
            where('traineeId', '==', trainee.id),
            where('moduleId', '==', module.id)
          )
        );

        const hasActive = existingSnap.docs.some((d) => {
          const data = d.data();
          return (
            data.status !== 'certified' &&
            data.status !== 'expired'
          );
        });

        if (hasActive && !settings.isRetraining) {
          skipped++;
          continue;
        }

        await addDoc(collection(db, 'trainingAssignments'), {
          companyId,
          moduleId: module.id,
          moduleName: module.title,
          machineId: module.machineId ?? '',
          machineName: module.machineName,
          traineeId: trainee.id,
          traineeName: trainee.fullName,
          traineeEmail: trainee.email ?? '',
          department: trainee.department ?? '',
          assignedBy: userProfile?.id ?? '',
          assignedByName: userProfile?.fullName ?? '',
          assignedAt: serverTimestamp(),
          dueDate: settings.dueDate
            ? new Date(settings.dueDate)
            : null,
          status: 'not_started',
          isRetraining: settings.isRetraining,
          retrainingReason: settings.isRetraining
            ? settings.retrainingReason
            : '',
          retrainingTriggeredAt: settings.isRetraining
            ? serverTimestamp()
            : null,
          lessonProgress: {},
          overallProgress: 0,
          lessonsCompleted: 0,
          totalLessons: module.lessons.length,
          quizAttempts: [],
          bestScore: 0,
          latestScore: 0,
          quizPassed: false,
          quizPassedAt: null,
          attemptsUsed: 0,
          practicalSignOff: module.quiz
            ? {
                required: true,
                signedOffBy: '',
                signedOffByName: '',
                signedOffAt: null,
                observations: '',
                passed: false,
              }
            : null,
          certificateId: null,
          certifiedAt: null,
          certificateExpiryDate: null,
          startedAt: null,
          completedAt: null,
          lastActivityAt: null,
        });
      }

      setSkippedCount(skipped);
      setDone(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create assignments'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const totalPairs = selectedTrainees.length * selectedModules.length;
    const created = totalPairs - skippedCount;
    return (
      <div className="flex flex-col items-center py-12 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          Assignments Created
        </h2>
        <p className="text-gray-600">
          {created} assignment{created !== 1 ? 's' : ''} created successfully.
          {skippedCount > 0 && (
            <span className="block text-sm text-amber-600 mt-1">
              {skippedCount} duplicate{skippedCount !== 1 ? 's' : ''} skipped.
            </span>
          )}
        </p>
        <button
          onClick={onComplete}
          className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  i === step
                    ? 'bg-blue-600 text-white'
                    : i < step
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 0 — Select Trainees */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search trainees..."
              value={traineeSearch}
              onChange={(e) => setTraineeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {traineesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={
                    trainees.length > 0 &&
                    selectedTrainees.length === trainees.length
                  }
                  onChange={selectAllTrainees}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-600">
                  Select All ({trainees.length})
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {trainees.length === 0 ? (
                  <p className="text-center py-8 text-sm text-gray-400">
                    No trainees found.
                  </p>
                ) : (
                  trainees.map((trainee) => (
                    <label
                      key={trainee.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          !!selectedTrainees.find((t) => t.id === trainee.id)
                        }
                        onChange={() => toggleTrainee(trainee)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {trainee.fullName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {trainee.department ?? 'No department'} &middot;{' '}
                          {trainee.jobTitle ?? trainee.role}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            {selectedTrainees.length} trainee
            {selectedTrainees.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}

      {/* Step 1 — Select Modules */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search modules..."
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {modulesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {filteredModules.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">
                  No active modules found.
                </p>
              ) : (
                filteredModules.map((mod) => (
                  <label
                    key={mod.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedModules.find((m) => m.id === mod.id)}
                      onChange={() => toggleModule(mod)}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {mod.title}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{mod.machineName}</span>
                        <span>&middot;</span>
                        <span>{mod.lessons.length} lessons</span>
                        <span>&middot;</span>
                        <Clock className="w-3 h-3" />
                        <span>{mod.estimatedMinutes} min</span>
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}

          <p className="text-sm text-gray-500">
            {selectedModules.length} module
            {selectedModules.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}

      {/* Step 2 — Settings */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={settings.dueDate}
              onChange={(e) =>
                setSettings((s) => ({ ...s, dueDate: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Is Retraining</p>
              <p className="text-xs text-gray-500">
                Mark this as a retraining assignment
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, isRetraining: !s.isRetraining }))
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.isRetraining ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.isRetraining ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {settings.isRetraining && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retraining Reason
              </label>
              <textarea
                rows={3}
                value={settings.retrainingReason}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    retrainingReason: e.target.value,
                  }))
                }
                placeholder="Explain why retraining is required..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Notify Trainee
              </p>
              <p className="text-xs text-gray-500">
                Send notification when assignment is created
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  notifyTrainee: !s.notifyTrainee,
                }))
              }
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.notifyTrainee ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.notifyTrainee ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Review & Confirm */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800 text-sm">
            Assigning{' '}
            <strong>{selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''}</strong>{' '}
            to{' '}
            <strong>
              {selectedTrainees.length} trainee{selectedTrainees.length !== 1 ? 's' : ''}
            </strong>{' '}
            ({selectedTrainees.length * selectedModules.length} total
            assignments)
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Trainee
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Module
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedTrainees.map((trainee) =>
                  selectedModules.map((mod) => (
                    <tr key={`${trainee.id}-${mod.id}`}>
                      <td className="px-4 py-2 text-gray-900">
                        {trainee.fullName}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{mod.title}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            onClick={() => handleStepChange(step + 1)}
            disabled={
              (step === 0 && selectedTrainees.length === 0) ||
              (step === 1 && selectedModules.length === 0)
            }
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Assign
          </button>
        )}
      </div>
    </div>
  );
}
