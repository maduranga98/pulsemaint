import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { createMachineSchema, type CreateMachineFormData } from '../../schemas/machine';
import type { MachineType, DocumentType } from '../../types/machine';
import { MachineFormStepper } from '../../components/machines/MachineFormStepper';

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

const DOCUMENT_TYPES: DocumentType[] = [
  'manual',
  'schematic',
  'warranty',
  'certificate',
  'sop',
  'other',
];

const FORM_STEPS = [
  { id: 'basic', label: 'Basic Information', description: 'Machine name, type, manufacturer' },
  { id: 'location', label: 'Location', description: 'Department, floor, bay, station' },
  { id: 'status', label: 'Status & Criticality', description: 'Status and criticality level' },
  { id: 'documents', label: 'Documents & Photos', description: 'Upload files and images' },
  { id: 'parts', label: 'Spare Parts', description: 'Compatible parts and notes' },
];

export function AddMachinePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateMachineFormData>({
    resolver: zodResolver(createMachineSchema),
    defaultValues: {
      siteId: user.siteId,
      status: 'active',
      criticality: 3,
      photoFiles: [],
      documentFiles: [],
      compatiblePartIds: [],
    },
  });

  const onSubmit = async (data: CreateMachineFormData) => {
    try {
      setSaving(true);
      setError(null);

      // TODO: Implement Firestore write
      console.log('Form data:', data);

      // Placeholder: simulate save
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // TODO: Show success toast
      navigate('/machines');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save machine';
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const formValues = watch();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New Machine</h1>
          <p className="text-gray-600 text-sm mt-1">Register a new machine in your facility</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {error}
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
              <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                {renderFormSection(currentStep, control, errors, formValues)}

                {/* Form Footer */}
                <div className="flex gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Saving...' : 'Save Machine'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/machines')}
                    disabled={saving}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          // Mobile: Single column with stepper
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <MachineFormStepper
                steps={FORM_STEPS}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                isDesktop={false}
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              {renderFormSection(currentStep, control, errors, formValues)}

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
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Saving...' : 'Save Machine'}
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/machines')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
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
  values: any
): React.ReactNode {
  switch (stepIndex) {
    case 0: // Basic Information
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Machine Name *
            </label>
            <input
              type="text"
              placeholder="e.g. CNC Lathe Machine 01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Machine Type *
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a type...</option>
              {MACHINE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
            {errors.type && <p className="text-red-600 text-sm mt-1">{errors.type.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer *
              </label>
              <input
                type="text"
                placeholder="e.g. Mazak Corporation"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.manufacturer && (
                <p className="text-red-600 text-sm mt-1">{errors.manufacturer.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                placeholder="e.g. QUICK TURN 200"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                placeholder="Unique serial number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Lifespan (years)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                placeholder="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Installation Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department *
            </label>
            <input
              type="text"
              placeholder="e.g. Production, Assembly, Maintenance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Floor
              </label>
              <input
                type="text"
                placeholder="e.g. Ground, 1st, 2nd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bay
              </label>
              <input
                type="text"
                placeholder="e.g. A1, B2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Station
              </label>
              <input
                type="text"
                placeholder="e.g. 01, 02"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            This location data will auto-fill Work Orders linked to this machine
          </p>
        </div>
      );

    case 2: // Status & Criticality
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Status & Criticality</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Status *
            </label>
            <div className="space-y-2">
              {(['active', 'under_maintenance', 'decommissioned'] as const).map((status) => (
                <label key={status} className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="ml-3 text-gray-700">{status.replace(/_/g, ' ').toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Criticality * (1 = Low, 5 = Mission Critical)
            </label>
            <input
              type="range"
              min="1"
              max="5"
              defaultValue="3"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Low</span>
              <span>Medium</span>
              <span>Mission Critical</span>
            </div>
          </div>
        </div>
      );

    case 3: // Documents & Photos
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Documents & Photos</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <p className="text-gray-600 text-sm mb-2">Drag and drop photos here</p>
              <input
                type="file"
                multiple
                accept="image/*"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-2">JPG, PNG, WEBP, HEIC up to 50MB each</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Documents
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <p className="text-gray-600 text-sm mb-2">Drag and drop documents here</p>
              <input
                type="file"
                multiple
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-2">PDF, DOCX, CAD files up to 100MB each</p>
            </div>
          </div>
        </div>
      );

    case 4: // Spare Parts & Notes
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Spare Parts & Notes</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modification Notes
            </label>
            <textarea
              rows={3}
              placeholder="Any modifications made to this machine..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              rows={3}
              placeholder="Any other information about this machine..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}
