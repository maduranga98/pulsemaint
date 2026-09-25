import { useState, useRef } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useDepartmentScope } from '../../hooks/useDepartmentScope';
import { usePlants } from '../../hooks/usePlants';

import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
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

const FORM_STEPS = [
  { id: 'basic', label: 'Basic Information', description: 'Machine name, type, manufacturer' },
  { id: 'location', label: 'Location', description: 'Department, floor, bay, station' },
  { id: 'status', label: 'Status & Criticality', description: 'Status, criticality and health score' },
  { id: 'documents', label: 'Documents & Photos', description: 'Upload files and images' },
  { id: 'spareparts', label: 'Spare Parts', description: 'Compatible/critical spare parts' },
  { id: 'notes', label: 'Notes & Warranty', description: 'Warranty, modifications, and extra notes' },
];

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
  const [currentStep, setCurrentStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [documentData, setDocumentData] = useState<Array<{ file: File; type: DocumentType; name: string }>>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  // The machine's plant: the caller's scoped plant (own plant; admin's
  // selected plant tab) for a new machine, the machine's own plant when
  // editing. Admin with no plant tab selected (or editing a plant-less
  // machine) picks the plant in the form — its departments follow it.
  const { plantId: scopedPlantId } = useDepartmentScope();
  const isAdmin = useAuthStore((s) => s.userProfile?.role) === 'admin';
  const basePlantId: string | null =
    mode === 'create' ? scopedPlantId : ((initialData as any)?.plantId ?? scopedPlantId);
  const showPlantPicker = isAdmin && !basePlantId;

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
          plantId: basePlantId,
        };

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting: formIsSubmitting },
  } = useForm<FormData>({
    // create/update use different Zod schemas depending on `mode`, so their
    // inferred resolver types don't unify cleanly with the FormData union.
    resolver: zodResolver(schema as never) as Resolver<FormData>,
    defaultValues,
  });

  const formPlantId: string | null = ((watch as (name: string) => unknown)('plantId') as string | null | undefined) || basePlantId;

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
      const errorMsg = err instanceof Error ? err.message : 'Failed to save machine';
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
            {mode === 'create' ? 'Add New Machine' : 'Edit Machine'}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {mode === 'create' ? 'Register a new machine in your facility' : `Editing ${initialData?.name}`}
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
                  formPlantId,
                  showPlantPicker
                )}

                {/* Form Footer */}
                <div className="flex gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={isSubmitting || formIsSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSubmitting || formIsSubmitting ? 'Saving...' : `${mode === 'create' ? 'Create' : 'Update'} Machine`}
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
                formPlantId,
                showPlantPicker
              )}

              {/* Mobile Navigation */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    {t('common.ui2.machines.machineForm.back')}
                  </button>
                )}
                {currentStep < FORM_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    {t('common.ui2.machines.machineForm.next')}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || formIsSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSubmitting || formIsSubmitting ? 'Saving...' : `${mode === 'create' ? 'Create' : 'Update'} Machine`}
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.machineType')}</label>
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
                <option value="">{t('common.ui2.machines.machineForm.selectAType')}</option>
                {MACHINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
                <option value={CUSTOM_TYPE_OPTION}>{t('common.ui2.machines.machineForm.otherEnterCustomType')}</option>
              </select>
              {isCustom && (
                <input
                  type="text"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  placeholder={t('common.ui2.machines.machineForm.eGInjectionMolderPackaging')}
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
  formPlantId: string | null,
  showPlantPicker: boolean
): React.ReactNode {
  // Plain render helper (not a component) — the parent's useTranslation
  // subscription re-renders it on language change.
  const t = i18n.t.bind(i18n);
  switch (stepIndex) {
    case 0: // Basic Information
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.ui2.machines.machineForm.basicInformation')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.machineName')}</label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  placeholder={t('common.ui2.machines.machineForm.eGCncLatheMachine')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <MachineTypeField control={control} errors={errors} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.manufacturer')}</label>
              <Controller
                name="manufacturer"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.ui2.machines.machineForm.eGMazakCorporation')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
              {errors.manufacturer && (
                <p className="text-red-600 text-sm mt-1">{errors.manufacturer.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.model')}</label>
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.ui2.machines.machineForm.eGQuickTurn200')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.serialNumber')}</label>
              <Controller
                name="serialNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.ui2.machines.machineForm.uniqueSerialNumber')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.expectedLifespanYears')}</label>
              <Controller
                name="expectedLifespanYears"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="10"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.purchaseDate')}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.installationDate')}</label>
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
          <h2 className="text-lg font-semibold text-gray-900">{t('common.ui2.machines.machineForm.location')}</h2>

          {showPlantPicker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.plant')}</label>
              <Controller
                name={'plantId' as never}
                control={control}
                render={({ field }) => (
                  <PlantSelect value={(field.value as string | null) ?? ''} onChange={(v) => field.onChange(v || null)} />
                )}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.department')}</label>
            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <DepartmentComboBox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  // Full plant-picker for machines lands with the Machines
                  // pilot rollout; for now department is scoped to the
                  // creating user's own plant.
                  plantId={formPlantId}
                />
              )}
            />
            {errors.department && <p className="text-red-600 text-sm mt-1">{errors.department.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.floor')}</label>
              <Controller
                name="floor"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder={t('common.ui2.machines.machineForm.eGGround1st2nd')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.bay')}</label>
              <Controller
                name="bay"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. A1, B2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.station')}</label>
              <Controller
                name="station"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. 01, 02"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">{t('common.ui2.machines.machineForm.thisLocationDataWillAuto')}</p>
        </div>
      );

    case 2: // Status & Criticality
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.ui2.machines.machineForm.statusCriticality')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">{t('common.ui2.machines.machineForm.status')}</label>
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
                      <span className="ml-3 text-gray-700">{status.replace(/_/g, ' ').toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Criticality * (1 = Low, 5 = Mission Critical)
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
                    <span>{t('common.ui2.machines.machineForm.low')}</span>
                    <span>Medium ({field.value})</span>
                    <span>{t('common.ui2.machines.machineForm.missionCritical')}</span>
                  </div>
                </>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {mode === 'create' ? 'Initial Health Score' : 'Health Score'} (0 = Critical, 100 = Perfect)
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
                    <span>{t('common.ui2.machines.machineForm.critical0')}</span>
                    <span className={`font-medium ${(field.value ?? 100) >= 70 ? 'text-green-600' : (field.value ?? 100) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {field.value ?? 100}%
                    </span>
                    <span>{t('common.ui2.machines.machineForm.perfect100')}</span>
                  </div>
                </>
              )}
            />
            {(errors as any).healthScore && (
              <p className="text-red-600 text-sm mt-1">{(errors as any).healthScore.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.nextPmDate')}</label>
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
              {t('common.ui2.machines.machineForm.dateTheNextPreventiveMaintenance')}
            </p>
          </div>
        </div>
      );

    case 3: // Documents & Photos
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('common.ui2.machines.machineForm.documentsPhotos')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.ui2.machines.machineForm.photos')}</label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
              onClick={() => photoInputRef.current?.click()}
            >
              <p className="text-gray-600 text-sm mb-2">{t('common.ui2.machines.machineForm.clickOrDragPhotosHere')}</p>
              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={onPhotoChange}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-2">JPG, PNG, WEBP, HEIC up to 50MB each</p>
            </div>
            {photoFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {photoFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <button type="button" onClick={() => onRemovePhoto(idx)} className="text-xs text-red-600 hover:text-red-800">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Documents</label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
              onClick={() => docInputRef.current?.click()}
            >
              <p className="text-gray-600 text-sm mb-2">Click or drag documents here</p>
              <input
                ref={docInputRef}
                type="file"
                multiple
                onChange={onDocumentChange}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-2">PDF, DOCX, CAD files up to 100MB each</p>
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
                      Remove
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
          <h2 className="text-lg font-semibold text-gray-900">Spare Parts</h2>
          <p className="text-sm text-gray-600">
            List compatible part IDs/numbers (one per line). These will be linked to the machine for fast lookup during work orders.
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
                placeholder="PN-12345&#10;BRG-6204&#10;BELT-A48"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            )}
          />
        </div>
      );

    case 5: // Additional Notes & Warranty
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Additional Notes</h2>

          {/* Warranty Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.ui2.machines.machineForm.warrantyInformation')}</label>
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
                            placeholder={t('common.ui2.machines.machineForm.partComponentName')}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-xs text-red-600 hover:text-red-800 px-2"
                          >
                            {t('common.ui2.machines.machineForm.remove')}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('common.ui2.machines.machineForm.warrantyExpiryDate')}</label>
                            <input
                              type="date"
                              value={item.expiryDate instanceof Date ? item.expiryDate.toISOString().split('T')[0] : ''}
                              onChange={(e) => updateItem(idx, 'expiryDate', e.target.value ? new Date(e.target.value) : null)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('common.ui2.machines.machineForm.supplierReference')}</label>
                            <input
                              type="text"
                              value={item.supplierWarrantyRef}
                              onChange={(e) => updateItem(idx, 'supplierWarrantyRef', e.target.value)}
                              placeholder={t('common.ui2.machines.machineForm.eGWr2025001')}
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
                      + Add Warranty Item
                    </button>
                  </div>
                );
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.modificationNotes')}</label>
            <Controller
              name="modificationNotes"
              control={control}
              render={({ field }) => (
                <textarea
                  rows={4}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  placeholder={t('common.ui2.machines.machineForm.documentAnyModificationsMadeTo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            {(errors as any).modificationNotes && (
              <p className="text-red-600 text-sm mt-1">{(errors as any).modificationNotes.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.ui2.machines.machineForm.additionalNotes')}</label>
            <Controller
              name="additionalNotes"
              control={control}
              render={({ field }) => (
                <textarea
                  rows={4}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  placeholder={t('common.ui2.machines.machineForm.anyOtherRelevantInformation')}
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

function PlantSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { activePlants } = usePlants(companyId);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="">{t('common.ui2.machines.machineForm.selectAPlant')}</option>
      {activePlants.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

interface DepartmentComboBoxProps {
  value: string;
  onChange: (val: string) => void;
  plantId: string | null;
}

function DepartmentComboBox({ value, onChange, plantId }: DepartmentComboBoxProps) {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { departments, loading, addDepartment } = useDepartments(companyId, plantId);
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

  // Departments belong to a plant — nothing to list or add until one is set.
  if (!plantId) {
    return <p className="text-sm text-amber-600">{t('common.ui2.machines.machineForm.selectAPlantFirstTo')}</p>;
  }

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
            <option value="">{t('common.ui2.machines.machineForm.selectADepartment')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value="__add__">+ Add new department...</option>
          </select>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder={t('common.ui2.machines.machineForm.newDepartmentName')}
            autoFocus
            className="flex-1 px-3 py-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            {t('common.ui2.machines.machineForm.add')}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName(''); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
      {loading && <p className="text-xs text-gray-400">{t('common.ui2.machines.machineForm.loadingDepartments')}</p>}
    </div>
  );
}

