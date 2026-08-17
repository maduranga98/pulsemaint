import { useState, useRef } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import {
  createMachineSchema,
  updateMachineSchema,
  type CreateMachineFormData,
  type UpdateMachineFormData,
} from '../../schemas/machine';
import type { MachineType, DocumentType, Machine } from '../../types/machine';
import { MachineFormStepper } from './MachineFormStepper';
import { useDepartments } from '../../hooks/useDepartments';

const CUSTOM_TYPE_OPTION = '__custom__';

const MACHINE_TYPES: MachineType[] = [
  'cnc_machine',
  'conveyor',
  'compressor',
  'boiler',
  'generator',
  'hydraulic_press',
  'pump',
  'motor',
  'crane',
  'lathe',
  'milling_machine',
  'welding_machine',
  'hvac',
  'other',
];

const FORM_STEP_IDS = ['basic', 'location', 'status', 'documents', 'spareparts', 'notes'] as const;

type FormData = CreateMachineFormData | UpdateMachineFormData;

interface MachineFormProps {
  mode: 'create' | 'edit';
  initialData?: Machine;
  onSubmit: (data: FormData, files: { photos: File[]; documents: Array<{ file: File; type: DocumentType; name: string }> }) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
  siteId: string;
}

export function MachineForm({
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error: externalError,
  siteId,
}: MachineFormProps) {
  const { t } = useTranslation();
  const FORM_STEPS = FORM_STEP_IDS.map((id) => ({
    id,
    label: t(`common.machines.form.steps.${id}.label`),
    description: t(`common.machines.form.steps.${id}.description`),
  }));
  const [currentStep, setCurrentStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [documentData, setDocumentData] = useState<Array<{ file: File; type: DocumentType; name: string }>>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  const schema = mode === 'create' ? createMachineSchema : updateMachineSchema;
  const defaultValues =
    mode === 'create'
      ? {
          siteId,
          status: 'active' as const,
          criticality: 3 as const,
          healthScore: 100,
          photoFiles: [],
          documentFiles: [],
          compatiblePartIds: [],
        } as any
      : {
          name: initialData?.name,
          type: initialData?.type,
          manufacturer: initialData?.manufacturer,
          model: initialData?.model,
          serialNumber: initialData?.serialNumber,
          purchaseDate: initialData?.purchaseDate ? new Date(initialData.purchaseDate.seconds * 1000) : null,
          installationDate: initialData?.installationDate
            ? new Date(initialData.installationDate.seconds * 1000)
            : null,
          nextPmDue: initialData?.nextPmDue
            ? new Date(initialData.nextPmDue.seconds * 1000)
            : null,
          expectedLifespanYears: initialData?.expectedLifespanYears,
          department: initialData?.department,
          floor: initialData?.floor,
          bay: initialData?.bay,
          station: initialData?.station,
          status: initialData?.status,
          criticality: initialData?.criticality,
          modificationNotes: initialData?.modificationNotes,
          additionalNotes: (initialData as any)?.additionalNotes ?? null,
          photoFiles: [],
          documentFiles: [],
          healthScore: initialData?.healthScore ?? 100,
          warrantyItems: initialData?.warrantyItems?.map((w: any) => ({
            partName: w.partName ?? '',
            expiryDate: w.expiryDate?.toDate?.() ?? (w.expiryDate?.seconds ? new Date(w.expiryDate.seconds * 1000) : null),
            supplierWarrantyRef: w.supplierWarrantyRef ?? '',
          })) ?? [],
          compatiblePartIds: initialData?.compatiblePartIds || [],
        };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting: formIsSubmitting },
  } = useForm<FormData>({
    // create/update use different Zod schemas depending on `mode`, so their
    // inferred resolver types don't unify cleanly with the FormData union.
    resolver: zodResolver(schema as never) as Resolver<FormData>,
    defaultValues,
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles((prev) => [...prev, ...files]);
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newDocs = files.map((file) => ({
      file,
      type: 'other' as DocumentType,
      name: file.name.replace(/\.[^/.]+$/, ''),
    }));
    setDocumentData((prev) => [...prev, ...newDocs]);
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDocument = (index: number) => {
    setDocumentData((prev) => prev.filter((_, i) => i !== index));
  };

  const FIELD_STEP_MAP: Record<string, number> = {
    name: 0, type: 0, manufacturer: 0, model: 0, serialNumber: 0,
    purchaseDate: 0, installationDate: 0, expectedLifespanYears: 0,
    department: 1, floor: 1, bay: 1, station: 1,
    status: 2, criticality: 2, healthScore: 2, nextPmDue: 2,
    photoFiles: 3, documentFiles: 3,
    compatiblePartIds: 4,
    warrantyItems: 5, modificationNotes: 5, additionalNotes: 5,
  };

  const handleFormSubmit = async (formData: FormData) => {
    try {
      setLocalError(null);
      await onSubmit(formData, { photos: photoFiles, documents: documentData });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('common.machines.form.saveFailed');
      setLocalError(errorMsg);
    }
  };

  const handleValidationError = (errors: Record<string, unknown>) => {
    const firstErrorStep = Object.keys(errors).reduce((min, field) => {
      const step = FIELD_STEP_MAP[field] ?? 0;
      return step < min ? step : min;
    }, FORM_STEPS.length - 1);
    setCurrentStep(firstErrorStep);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'create' ? t('common.machines.form.addTitle') : t('common.machines.form.editTitle')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {mode === 'create'
              ? t('common.machines.form.addSubtitle')
              : t('common.machines.form.editSubtitle', { name: initialData?.name })}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {(externalError || localError) && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {externalError || localError}
          </div>
        )}

        {isDesktop ? (
          // Desktop: Two-column layout
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <MachineFormStepper
                steps={FORM_STEPS}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                isDesktop
              />
            </div>

            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit(handleFormSubmit, handleValidationError)} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                {renderFormSection(
                  currentStep,
                  control,
                  errors,
                  photoFiles,
                  documentData,
                  handlePhotoChange,
                  handleDocumentChange,
                  removePhoto,
                  removeDocument,
                  photoInputRef,
                  docInputRef,
                  mode,
                  t
                )}

                {/* Form Footer */}
                <div className="flex gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={isSubmitting || formIsSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSubmitting || formIsSubmitting ? t('common.machines.form.saving') : (mode === 'create' ? t('common.machines.form.createMachine') : t('common.machines.form.updateMachine'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          // Mobile: Single column with stepper
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <MachineFormStepper
                steps={FORM_STEPS}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                isDesktop={false}
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              {renderFormSection(
                currentStep,
                control,
                errors,
                photoFiles,
                documentData,
                handlePhotoChange,
                handleDocumentChange,
                removePhoto,
                removeDocument,
                photoInputRef,
                docInputRef,
                mode,
                t
              )}

              {/* Mobile Navigation */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    {t('common.machines.form.back')}
                  </button>
                )}
                {currentStep < FORM_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    {t('common.machines.form.next')}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || formIsSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSubmitting || formIsSubmitting ? t('common.machines.form.saving') : (mode === 'create' ? t('common.machines.form.createMachine') : t('common.machines.form.updateMachine'))}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function MachineTypeField({ control, errors }: { control: any; errors: any }) {
  const { t } = useTranslation();
  const [customSelected, setCustomSelected] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.machineTypeLabel')}</label>
      <Controller
        name="type"
        control={control}
        render={({ field }) => {
          const isCustom =
            customSelected || (!!field.value && !MACHINE_TYPES.includes(field.value));
          return (
            <div className="space-y-2">
              <select
                value={isCustom ? CUSTOM_TYPE_OPTION : (field.value ?? '')}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_TYPE_OPTION) {
                    setCustomSelected(true);
                    field.onChange('');
                  } else {
                    setCustomSelected(false);
                    field.onChange(e.target.value);
                  }
                }}
                onBlur={field.onBlur}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('common.machines.form.selectType')}</option>
                {MACHINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
                <option value={CUSTOM_TYPE_OPTION}>{t('common.machines.form.customTypeOption')}</option>
              </select>
              {isCustom && (
                <input
                  type="text"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  placeholder={t('common.machines.form.customTypePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          );
        }}
      />
      {errors.type && <p className="text-red-600 text-sm mt-1">{errors.type.message}</p>}
    </div>
  );
}

function renderFormSection(
  stepIndex: number,
  control: any,
  errors: any,
  photoFiles: File[],
  documentData: Array<{ file: File; type: DocumentType; name: string }>,
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onDocumentChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onRemovePhoto: (index: number) => void,
  onRemoveDocument: (index: number) => void,
  photoInputRef: React.RefObject<HTMLInputElement>,
  docInputRef: React.RefObject<HTMLInputElement>,
  mode: 'create' | 'edit',
  t: (key: string, opts?: any) => string
): React.ReactNode {
  switch (stepIndex) {
    case 0: // Basic Information
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.machines.form.basicInfoTitle')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.nameLabel')}</label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  placeholder={t('common.machines.form.namePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <MachineTypeField control={control} errors={errors} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.manufacturerLabel')}</label>
              <Controller
                name="manufacturer"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.machines.form.manufacturerPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
              {errors.manufacturer && (
                <p className="text-red-600 text-sm mt-1">{errors.manufacturer.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.modelLabel')}</label>
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.machines.form.modelPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.serialNumberLabel')}</label>
              <Controller
                name="serialNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.machines.form.serialNumberPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.lifespanLabel')}</label>
              <Controller
                name="expectedLifespanYears"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder={t('common.machines.form.lifespanPlaceholder')}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.purchaseDateLabel')}</label>
              <Controller
                name="purchaseDate"
                control={control}
                render={({ field }) => (
                  <input
                    type="date"
                    value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.installationDateLabel')}</label>
              <Controller
                name="installationDate"
                control={control}
                render={({ field }) => (
                  <input
                    type="date"
                    value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>
          </div>
        </div>
      );

    case 1: // Location
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.machines.form.locationTitle')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.departmentLabel')}</label>
            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <DepartmentComboBox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.department && <p className="text-red-600 text-sm mt-1">{errors.department.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.floorLabel')}</label>
              <Controller
                name="floor"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.machines.form.floorPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.bayLabel')}</label>
              <Controller
                name="bay"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.machines.form.bayPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.stationLabel')}</label>
              <Controller
                name="station"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.machines.form.stationPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">{t('common.machines.form.locationHint')}</p>
        </div>
      );

    case 2: // Status & Criticality
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.machines.form.statusCriticalityTitle')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">{t('common.machines.form.statusLabel')}</label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  {(['active', 'under_maintenance', 'decommissioned'] as const).map((status) => (
                    <label
                      key={status}
                      className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        {...field}
                        value={status}
                        checked={field.value === status}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="ml-3 text-gray-700">{t(`common.machines.statusBadge.${status === 'under_maintenance' ? 'underMaintenance' : status}`)}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('common.machines.form.criticalityLabel')}
            </label>
            <Controller
              name="criticality"
              control={control}
              render={({ field }) => (
                <>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>{t('common.machines.form.criticalityLow')}</span>
                    <span>{t('common.machines.form.criticalityMedium', { value: field.value })}</span>
                    <span>{t('common.machines.form.criticalityMissionCritical')}</span>
                  </div>
                </>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {mode === 'create' ? t('common.machines.form.initialHealthScoreLabel') : t('common.machines.form.healthScoreLabel')} {t('common.machines.form.healthScoreSuffix')}
            </label>
            <Controller
              name="healthScore"
              control={control}
              render={({ field }) => (
                <>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={field.value ?? 100}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>{t('common.machines.form.healthScoreCritical')}</span>
                    <span className={`font-medium ${(field.value ?? 100) >= 70 ? 'text-green-600' : (field.value ?? 100) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {field.value ?? 100}%
                    </span>
                    <span>{t('common.machines.form.healthScorePerfect')}</span>
                  </div>
                </>
              )}
            />
            {(errors as any).healthScore && (
              <p className="text-red-600 text-sm mt-1">{(errors as any).healthScore.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.nextPmDateLabel')}</label>
            <Controller
              name="nextPmDue"
              control={control}
              render={({ field }) => (
                <input
                  type="date"
                  value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('common.machines.form.nextPmDateHint')}
            </p>
          </div>
        </div>
      );

    case 3: // Documents & Photos
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.machines.form.documentsTitle')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.machines.form.photosLabel')}</label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
              onClick={() => photoInputRef.current?.click()}
            >
              <p className="text-gray-600 text-sm mb-2">{t('common.machines.form.photosDropHint')}</p>
              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={onPhotoChange}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-2">{t('common.machines.form.photosFormatHint')}</p>
            </div>
            {photoFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {photoFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <button type="button" onClick={() => onRemovePhoto(idx)} className="text-xs text-red-600 hover:text-red-800">
                      {t('common.machines.form.remove')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.machines.form.documentsLabel')}</label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
              onClick={() => docInputRef.current?.click()}
            >
              <p className="text-gray-600 text-sm mb-2">{t('common.machines.form.documentsDropHint')}</p>
              <input
                ref={docInputRef}
                type="file"
                multiple
                onChange={onDocumentChange}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-2">{t('common.machines.form.documentsFormatHint')}</p>
            </div>
            {documentData.length > 0 && (
              <div className="mt-3 space-y-2">
                {documentData.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500">{(doc.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveDocument(idx)}
                      className="ml-2 text-xs text-red-600 hover:text-red-800"
                    >
                      {t('common.machines.form.remove')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );

    case 4: // Spare Parts
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.machines.form.sparePartsTitle')}</h2>
          <p className="text-sm text-gray-600">
            {t('common.machines.form.sparePartsHint')}
          </p>
          <Controller
            name="compatiblePartIds"
            control={control}
            render={({ field }) => (
              <textarea
                rows={6}
                value={Array.isArray(field.value) ? field.value.join('\n') : ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder={t('common.machines.form.sparePartsPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            )}
          />
        </div>
      );

    case 5: // Additional Notes & Warranty
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.machines.form.additionalNotesTitle')}</h2>

          {/* Warranty Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.machines.form.warrantyInfoLabel')}</label>
            <Controller
              name="warrantyItems"
              control={control}
              render={({ field }) => {
                const items: Array<{ partName: string; expiryDate: Date | null; supplierWarrantyRef: string }> = field.value ?? [];
                const addItem = () => field.onChange([...items, { partName: '', expiryDate: null, supplierWarrantyRef: '' }]);
                const removeItem = (idx: number) => field.onChange(items.filter((_, i) => i !== idx));
                const updateItem = (idx: number, key: string, val: unknown) => {
                  const updated = items.map((item, i) => i === idx ? { ...item, [key]: val } : item);
                  field.onChange(updated);
                };

                return (
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2 bg-gray-50">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.partName}
                            onChange={(e) => updateItem(idx, 'partName', e.target.value)}
                            placeholder={t('common.machines.form.warrantyPartPlaceholder')}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-xs text-red-600 hover:text-red-800 px-2"
                          >
                            {t('common.machines.form.remove')}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('common.machines.form.warrantyExpiryLabel')}</label>
                            <input
                              type="date"
                              value={item.expiryDate instanceof Date ? item.expiryDate.toISOString().split('T')[0] : ''}
                              onChange={(e) => updateItem(idx, 'expiryDate', e.target.value ? new Date(e.target.value) : null)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('common.machines.form.warrantySupplierLabel')}</label>
                            <input
                              type="text"
                              value={item.supplierWarrantyRef}
                              onChange={(e) => updateItem(idx, 'supplierWarrantyRef', e.target.value)}
                              placeholder={t('common.machines.form.warrantySupplierPlaceholder')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {t('common.machines.form.addWarrantyItem')}
                    </button>
                  </div>
                );
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.modificationNotesLabel')}</label>
            <Controller
              name="modificationNotes"
              control={control}
              render={({ field }) => (
                <textarea
                  rows={4}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  placeholder={t('common.machines.form.modificationNotesPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            {(errors as any).modificationNotes && (
              <p className="text-red-600 text-sm mt-1">{(errors as any).modificationNotes.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.machines.form.additionalNotesLabel')}</label>
            <Controller
              name="additionalNotes"
              control={control}
              render={({ field }) => (
                <textarea
                  rows={4}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  placeholder={t('common.machines.form.additionalNotesPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            {(errors as any).additionalNotes && (
              <p className="text-red-600 text-sm mt-1">{(errors as any).additionalNotes.message}</p>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
}

interface DepartmentComboBoxProps {
  value: string;
  onChange: (val: string) => void;
}

function DepartmentComboBox({ value, onChange }: DepartmentComboBoxProps) {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { departments, loading, addDepartment } = useDepartments(companyId);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addDepartment(trimmed);
    onChange(trimmed);
    setNewName('');
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      {!adding ? (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={(e) => {
              if (e.target.value === '__add__') {
                setAdding(true);
              } else {
                onChange(e.target.value);
              }
            }}
            autoComplete="off"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('common.machines.form.selectDepartment')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value="__add__">{t('common.machines.form.addNewDepartment')}</option>
          </select>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder={t('common.machines.form.newDepartmentPlaceholder')}
            autoFocus
            className="flex-1 px-3 py-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            {t('common.machines.form.add')}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName(''); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
          >
            {t('common.machines.form.cancel')}
          </button>
        </div>
      )}
      {loading && <p className="text-xs text-gray-400">{t('common.machines.form.loadingDepartments')}</p>}
    </div>
  );
}

