import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { TrainingModule, TrainingLanguage, TrainingModuleStatus } from '@/lib/training/trainingTypes';

interface ModuleSettingsFormProps {
  defaultValues?: Partial<TrainingModule>;
  onSubmit: (data: Partial<TrainingModule>) => Promise<void>;
  isLoading?: boolean;
}

interface FormValues {
  title: string;
  description: string;
  machineName: string;
  estimatedMinutes: number;
  language: TrainingLanguage;
  passingScore: number;
  status: TrainingModuleStatus;
  tags: string;
  quizSettings: {
    practicalSignOffRequired: boolean;
    maxAttempts: number;
    timeLimit: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
}

export default function ModuleSettingsForm({
  defaultValues,
  onSubmit,
  isLoading = false,
}: ModuleSettingsFormProps) {
  const [quizOpen, setQuizOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      machineName: defaultValues?.machineName ?? '',
      estimatedMinutes: defaultValues?.estimatedMinutes ?? 30,
      language: defaultValues?.language ?? 'en',
      passingScore: defaultValues?.passingScore ?? 70,
      status: defaultValues?.status ?? 'draft',
      tags: (defaultValues?.tags ?? []).join(', '),
      quizSettings: {
        practicalSignOffRequired: true,
        maxAttempts: defaultValues?.quiz?.maxAttempts ?? 3,
        timeLimit: defaultValues?.quiz?.timeLimit ?? 0,
        shuffleQuestions: defaultValues?.quiz?.shuffleQuestions ?? false,
        shuffleOptions: defaultValues?.quiz?.shuffleOptions ?? false,
      },
    },
  });

  const watchedValues = watch(['quizSettings.practicalSignOffRequired', 'quizSettings.shuffleQuestions', 'quizSettings.shuffleOptions']);
  const practicalRequired = watchedValues[0];
  const shuffleQuestions = watchedValues[1];
  const shuffleOptions = watchedValues[2];

  async function handleFormSubmit(values: FormValues) {
    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const data: Partial<TrainingModule> = {
      title: values.title,
      description: values.description,
      machineName: values.machineName,
      estimatedMinutes: Number(values.estimatedMinutes),
      language: values.language,
      passingScore: Number(values.passingScore),
      status: values.status,
      tags,
    };

    await onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-5">
      {/* Module Info Section */}
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Module Info</h3>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Module Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('title', { required: 'Title is required' })}
          placeholder="e.g. CNC Machine Safety Training"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.title && (
          <p className="text-xs text-red-500">{errors.title.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Briefly describe what this module covers…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Machine Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('machineName', { required: 'Machine name is required' })}
          placeholder="e.g. Lathe Machine L-200"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.machineName && (
          <p className="text-xs text-red-500">{errors.machineName.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Duration</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              {...register('estimatedMinutes', { min: 1 })}
              min={1}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">min</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Passing Score</label>
          <div className="flex items-center gap-2">
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Language</label>
          <select
            {...register('language')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="en">English</option>
            <option value="si">Sinhala</option>
            <option value="ta">Tamil</option>
            <option value="bn">Bengali</option>
          </select>
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
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Tags</label>
        <input
          type="text"
          {...register('tags')}
          placeholder="safety, cnc, level-1  (comma-separated)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-400">Separate tags with commas</p>
      </div>

      {/* Quiz Settings Collapsible */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setQuizOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-700">Quiz Settings</span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${quizOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {quizOpen && (
          <div className="p-4 flex flex-col gap-4 bg-white">
            <ToggleRow
              label="Practical sign-off required"
              description="Learner must be signed off by a supervisor"
              checked={!!practicalRequired}
              onChange={(v) => setValue('quizSettings.practicalSignOffRequired', v)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Max attempts</label>
                <input
                  type="number"
                  {...register('quizSettings.maxAttempts', { min: 0 })}
                  min={0}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400">0 = unlimited</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Time limit</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    {...register('quizSettings.timeLimit', { min: 0 })}
                    min={0}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">min</span>
                </div>
                <p className="text-xs text-gray-400">0 = no limit</p>
              </div>
            </div>

            <ToggleRow
              label="Shuffle questions"
              checked={!!shuffleQuestions}
              onChange={(v) => setValue('quizSettings.shuffleQuestions', v)}
            />

            <ToggleRow
              label="Shuffle options"
              checked={!!shuffleOptions}
              onChange={(v) => setValue('quizSettings.shuffleOptions', v)}
            />
          </div>
        )}
      </div>

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

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <span className="text-xs text-gray-400">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
