import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import type {
  TrainingModule,
  TrainingModuleStatus,
  TraineeTrainingType,
  TrainingDeliveryMode,
} from '@/lib/training/trainingTypes';
import {
  TRAINEE_TRAINING_TYPE_LABELS,
  TRAINING_DELIVERY_MODE_LABELS,
} from '@/lib/training/trainingTypes';

// Sentinel select value that switches the Training Type field into a free-text
// input, so a company can add a training type beyond the built-in set
// (Electrical/Mechanical/HR/Civil/Technician/Operator/Safety Training/Other)
// without a code change. Stored as the raw typed string on the module.
const CUSTOM_TYPE_VALUE = '__custom__';

interface ModuleSettingsFormProps {
  defaultValues?: Partial<TrainingModule>;
  onSubmit: (data: Partial<TrainingModule>) => Promise<void>;
  isLoading?: boolean;
  /** When set, this form becomes a template for exactly one training type —
   *  the Training Type picker is hidden and every module saved from it is
   *  locked to this type. Used by the Safety Training creation flow so it
   *  can't accidentally produce a module of some other type that would then
   *  leak into the general Training tab. */
  lockTrainingType?: TraineeTrainingType;
}

interface FormValues {
  title: string;
  description: string;
  passingScore: number;
  status: TrainingModuleStatus;
  tags: string;
  // A custom (company-added) type is stored as the raw string the user
  // typed, not one of the built-in TraineeTrainingType values.
  trainingType: TraineeTrainingType | string | '';
  trainingMode: TrainingDeliveryMode | '';
}

/**
 * Settings form for the Training tab's module library only — machine /
 * competency modules. Deliberately minimal: title, description, training
 * type, mode, passing score, status, and tags. Existing Internal/Offboard
 * category data on a module (if any) is left untouched by this form — it's
 * not editable here. Trainee Management has its own form
 * (`TraineeModuleSettingsForm`); neither branches on which library it is in.
 */
export default function ModuleSettingsForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  lockTrainingType,
}: ModuleSettingsFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      passingScore: defaultValues?.passingScore ?? 70,
      // New modules default to Active so they can be assigned as soon as
      // they're created — a draft has no Assign action, which left authors
      // with a module they couldn't hand to anyone. Draft stays an explicit
      // choice in the picker below.
      status: defaultValues?.status ?? 'active',
      tags: (defaultValues?.tags ?? []).join(', '),
      trainingType: lockTrainingType ?? defaultValues?.trainingType ?? '',
      trainingMode: defaultValues?.trainingMode ?? '',
    },
  });

  // A module already saved with a type outside the built-in set (added via
  // "+ Add new type…" previously) opens straight into the free-text field
  // instead of silently falling back to the picker with nothing selected.
  const [isCustomType, setIsCustomType] = useState(() => {
    const initial = lockTrainingType ?? defaultValues?.trainingType;
    return !!initial && !(initial in TRAINEE_TRAINING_TYPE_LABELS);
  });
  const trainingTypeValue = watch('trainingType');
  // Establishes the field's validation rule with RHF regardless of which
  // branch (select vs. free-text) is currently mounted — the select below is
  // controlled via value/onChange rather than a spread ref, since it also
  // has to intercept the "+ Add new type…" sentinel before it ever reaches
  // form state.
  register('trainingType', { required: 'Training type is required' });

  async function handleFormSubmit(values: FormValues) {
    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const data: Partial<TrainingModule> = {
      title: values.title,
      description: values.description,
      // Modules are classified by training type and delivery mode rather than
      // by machine, so keep machineName empty and preserve the module's
      // existing language (the picker was removed — everything is authored in
      // the company's own language).
      machineName: '',
      estimatedMinutes: defaultValues?.estimatedMinutes ?? 0,
      language: defaultValues?.language ?? 'en',
      passingScore: Number(values.passingScore),
      status: values.status,
      tags,
      trainingType: values.trainingType as TraineeTrainingType,
      trainingMode: values.trainingMode as TrainingDeliveryMode,
      libraryScope: 'training',
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

      {!lockTrainingType && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Training Type <span className="text-red-500">*</span>
          </label>
          {isCustomType ? (
            <div className="flex gap-2">
              <input
                type="text"
                {...register('trainingType', { required: 'Training type is required' })}
                placeholder="e.g. Forklift Certification"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setIsCustomType(false);
                  setValue('trainingType', '');
                }}
                className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap"
              >
                Choose from list
              </button>
            </div>
          ) : (
            <select
              value={trainingTypeValue}
              onChange={(e) => {
                if (e.target.value === CUSTOM_TYPE_VALUE) {
                  setIsCustomType(true);
                  setValue('trainingType', '');
                } else {
                  setValue('trainingType', e.target.value, { shouldValidate: true });
                }
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Select training type…</option>
              {Object.entries(TRAINEE_TRAINING_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
              <option value={CUSTOM_TYPE_VALUE}>+ Add new type…</option>
            </select>
          )}
          {errors.trainingType && <p className="text-xs text-red-500">{errors.trainingType.message}</p>}
        </div>
      )}

      {lockTrainingType && (
        <input type="hidden" value={lockTrainingType} {...register('trainingType')} />
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Mode <span className="text-red-500">*</span>
        </label>
        <select
          {...register('trainingMode', { required: 'Mode is required' })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">Select mode…</option>
          {Object.entries(TRAINING_DELIVERY_MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {errors.trainingMode && <p className="text-xs text-red-500">{errors.trainingMode.message}</p>}
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
          placeholder="safety, cnc, level-1  (comma-separated)"
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
