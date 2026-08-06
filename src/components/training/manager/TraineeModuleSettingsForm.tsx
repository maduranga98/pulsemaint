import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import type {
  TrainingModule,
  TrainingModuleStatus,
  TraineeTrainingType,
} from '@/lib/training/trainingTypes';
import { TRAINEE_TRAINING_TYPE_LABELS } from '@/lib/training/trainingTypes';

interface TraineeModuleSettingsFormProps {
  defaultValues?: Partial<TrainingModule>;
  onSubmit: (data: Partial<TrainingModule>) => Promise<void>;
  isLoading?: boolean;
}

interface FormValues {
  title: string;
  description: string;
  passingScore: number;
  status: TrainingModuleStatus;
  tags: string;
  trainingType: TraineeTrainingType | '';
}

/**
 * Settings form for Trainee Management's module library only.
 *
 * Deliberately minimal: only training type, passing score, tags, and
 * description — lessons/quiz are authored separately in the editor. No due
 * dates or time periods belong on a module; those live on the Program that
 * assigns it. It also has no Internal/Offboard category picker and no
 * machine field — those are Training-tab concepts and live in
 * `ModuleSettingsForm`. Neither form branches on which library it is in.
 */
export default function TraineeModuleSettingsForm({
  defaultValues,
  onSubmit,
  isLoading = false,
}: TraineeModuleSettingsFormProps) {
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<FormValues>({
      defaultValues: {
        title: defaultValues?.title ?? '',
        description: defaultValues?.description ?? '',
        passingScore: defaultValues?.passingScore ?? 70,
        // New modules default to Active so the assign wizard (which only
        // offers active modules) can see them immediately.
        status: defaultValues?.status ?? 'active',
        tags: (defaultValues?.tags ?? []).join(', '),
        trainingType: defaultValues?.trainingType ?? '',
      },
    });

    async function handleFormSubmit(values: FormValues) {
      const tags = values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const data: Partial<TrainingModule> = {
        title: values.title,
        description: values.description,
        machineName: '',
        estimatedMinutes: defaultValues?.estimatedMinutes ?? 0,
        // The language picker was removed — preserve whatever the module
        // already had rather than resetting it.
        language: defaultValues?.language ?? 'en',
        passingScore: Number(values.passingScore),
        status: values.status,
        tags,
        trainingType: values.trainingType as TraineeTrainingType,
        // Delivery mode and due durations aren't module-level concerns here
        // — a Program sets its own per-module due duration when assigned.
        trainingMode: defaultValues?.trainingMode ?? 'online',
        // A trainee module is never an offboard/external one — that category
        // only exists in the Training tab's library.
        category: 'machine',
        offboardDetails: null,
        libraryScope: 'trainee_management',
      };

      await onSubmit(data);
    }

    return (
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Trainee Module Info</h3>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Module Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('title', { required: 'Title is required' })}
            placeholder="e.g. Electrical Trainee Orientation"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Briefly describe what this programme module covers…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Training Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('trainingType', { required: 'Training type is required' })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select training type…</option>
            {Object.entries(TRAINEE_TRAINING_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.trainingType && <p className="text-xs text-red-500">{errors.trainingType.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Passing Score</label>
          <div className="flex items-center gap-2 w-40">
            <input
              type="number"
              {...register('passingScore', { min: 50, max: 100 })}
              min={50}
              max={100}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            {...register('status')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Tags</label>
          <input
            type="text"
            {...register('tags')}
            placeholder="electrical, trainee, safety  (comma-separated)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400">Separate tags with commas</p>
        </div>

        {/* Real quiz settings (pass score, attempts, time limit, shuffle)
            live on the Quiz Builder page for this module, not here — this
            form no longer duplicates a settings panel whose values were
            never saved. */}

        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 px-4 text-sm transition-colors"
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          Save Module
        </button>
      </form>
    );
}
