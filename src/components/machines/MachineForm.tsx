import { useState, useRef, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import {
  createMachineSchema,
  updateMachineSchema,
  type CreateMachineFormData,
  type UpdateMachineFormData,
} from '../../schemas/machine';
import type { MachineType, DocumentType, Machine } from '../../types/machine';
import { MachineFormStepper } from './MachineFormStepper';

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
  { id: 'parts', label: 'Spare Parts', description: 'Compatible parts and notes' },
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
          status: 'active',
          criticality: 3,
          healthScore: 100,
          photoFiles: [],
          documentFiles: [],
          compatiblePartIds: [],
        }
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
          compatiblePartIds: initialData?.compatiblePartIds || [],
        };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting: formIsSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
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
    status: 2, criticality: 2, healthScore: 2,
    photoFiles: 3, documentFiles: 3,
    compatiblePartIds: 4, modificationNotes: 4, additionalNotes: 4,
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
                  mode
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
                mode
              )}

              {/* Mobile Navigation */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Back
                  </button>
                )}
                {currentStep < FORM_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Next
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
  mode: 'create' | 'edit'
): React.ReactNode {
  switch (stepIndex) {
    case 0: // Basic Information
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Machine Name *</label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  placeholder="e.g. CNC Lathe Machine 01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Machine Type *</label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a type...</option>
                  {MACHINE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.type && <p className="text-red-600 text-sm mt-1">{errors.type.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer *</label>
              <Controller
                name="manufacturer"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Mazak Corporation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
              {errors.manufacturer && (
                <p className="text-red-600 text-sm mt-1">{errors.manufacturer.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. QUICK TURN 200"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
              <Controller
                name="serialNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="Unique serial number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Lifespan (years)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
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
          <h2 className="text-lg font-semibold text-gray-900">Location</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  placeholder="e.g. Production, Assembly, Maintenance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
              <Controller
                name="floor"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Ground, 1st, 2nd"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bay</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
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

          <p className="text-xs text-gray-500">This location data will auto-fill Work Orders linked to this machine</p>
        </div>
      );

    case 2: // Status & Criticality
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Status & Criticality</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Status *</label>
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
                    <span>Low</span>
                    <span>Medium ({field.value})</span>
                    <span>Mission Critical</span>
                  </div>
                </>
              )}
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Initial Health Score (0 = Critical, 100 = Perfect)
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
                      <span>Critical (0)</span>
                      <span className={`font-medium ${(field.value ?? 100) >= 70 ? 'text-green-600' : (field.value ?? 100) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {field.value ?? 100}%
                      </span>
                      <span>Perfect (100)</span>
                    </div>
                  </>
                )}
              />
              {(errors as any).healthScore && (
                <p className="text-red-600 text-sm mt-1">{(errors as any).healthScore.message}</p>
              )}
            </div>
          )}
        </div>
      );

    case 3: // Documents & Photos
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Documents & Photos</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
              onClick={() => photoInputRef.current?.click()}
            >
              <p className="text-gray-600 text-sm mb-2">Click or drag photos here</p>
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

    case 4: // Spare Parts & Notes
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Spare Parts & Notes</h2>

          <SparePartsSelector control={control} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modification Notes</label>
            <Controller
              name="modificationNotes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={3}
                  placeholder="Any modifications made to this machine..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={field.value ?? ''}
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
            <Controller
              name="additionalNotes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={3}
                  placeholder="Any other information about this machine..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={field.value ?? ''}
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

interface CatalogPart {
  id: string;
  name: string;
  partNumber: string;
}

function SparePartsSelector({ control }: { control: any }) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [catalog, setCatalog] = useState<CatalogPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const selectedIds: string[] = useWatch({ control, name: 'compatiblePartIds' }) ?? [];

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'inventoryParts'), where('companyId', '==', companyId)),
        );
        if (cancelled) return;
        setCatalog(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: (data.name as string) ?? d.id,
              partNumber: (data.partNumber as string) ?? '',
            };
          }),
        );
      } catch (err) {
        console.error('Failed to load parts catalog', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filtered = catalog.filter(
    (p) =>
      !selectedIds.includes(p.id) &&
      (search.trim() === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.partNumber.toLowerCase().includes(search.toLowerCase())),
  );
  const selectedParts = selectedIds
    .map((id) => catalog.find((c) => c.id === id))
    .filter((p): p is CatalogPart => Boolean(p));

  return (
    <Controller
      name="compatiblePartIds"
      control={control}
      render={({ field }) => {
        const value: string[] = field.value ?? [];
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Compatible Spare Parts</label>

            {value.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedParts.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full border border-blue-200"
                  >
                    {p.name}
                    {p.partNumber && <span className="text-blue-400">· {p.partNumber}</span>}
                    <button
                      type="button"
                      onClick={() => field.onChange(value.filter((id) => id !== p.id))}
                      className="ml-1 text-blue-400 hover:text-red-500"
                      aria-label={`Remove ${p.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {selectedIds.length > selectedParts.length && (
                  <span className="text-xs text-gray-400 self-center">
                    ({selectedIds.length - selectedParts.length} part(s) not in current catalog)
                  </span>
                )}
              </div>
            )}

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parts by name or part number…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {loading ? (
              <p className="text-xs text-gray-400 mt-2">Loading catalog…</p>
            ) : catalog.length === 0 ? (
              <p className="text-xs text-gray-500 mt-2">
                No parts in your inventory catalog yet. Add parts under Inventory → Catalog to link them here.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 mt-2">
                {search ? 'No matching parts.' : 'All catalog parts already selected.'}
              </p>
            ) : (
              <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {filtered.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => field.onChange([...value, p.id])}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between"
                  >
                    <span>
                      <span className="font-medium text-gray-800">{p.name}</span>
                      {p.partNumber && <span className="text-gray-400"> · {p.partNumber}</span>}
                    </span>
                    <span className="text-xs text-blue-600">+ Add</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {value.length} part{value.length === 1 ? '' : 's'} selected
            </p>
          </div>
        );
      }}
    />
  );
}
