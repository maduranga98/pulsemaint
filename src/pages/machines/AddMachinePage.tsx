import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useMachineCreate } from '../../hooks/useMachineCreate';
import { usePlanLimitCheck } from '../../hooks/usePlanLimitCheck';
import { useToast } from '../../hooks/useToast';
import { useDepartmentScope } from '../../hooks/useDepartmentScope';
import type { CreateMachineFormData } from '../../schemas/machine';
import type { CreateMachinePayload, MachineCriticality } from '../../types/machine';
import { MachineForm } from '../../components/machines/MachineForm';

export function AddMachinePage() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const { createMachine, creating } = useMachineCreate();
  // Own plant for plant-scoped roles; for admin, whichever plant tab is
  // active (null on "All Plants" — the machine lands unassigned, same as
  // any other plant-less record, until a plant is picked for it).
  const { plantId } = useDepartmentScope();
  const { success, error: showError } = useToast();
  const { loading: limitLoading, atLimit, message: limitMessage } = usePlanLimitCheck('machines');

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const siteId = userProfile.siteIds[0] || userProfile.companyId;

  if (!limitLoading && atLimit) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
          <Lock className="w-8 h-8 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">Machine limit reached</h1>
          <p className="text-sm text-slate-600">{limitMessage}</p>
          <Link
            to="/app/billing"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            Upgrade plan
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (
    formData: CreateMachineFormData,
    files: { photos: File[]; documents: Array<{ file: File; type: any; name: string }> }
  ) => {
    try {
      const payload: CreateMachinePayload = {
        siteId,
        plantId,
        name: formData.name,
        type: formData.type,
        manufacturer: formData.manufacturer,
        model: formData.model || '',
        serialNumber: formData.serialNumber || '',
        purchaseDate: formData.purchaseDate || null,
        installationDate: formData.installationDate || null,
        nextPmDue: formData.nextPmDue || null,
        expectedLifespanYears: formData.expectedLifespanYears || null,
        department: formData.department,
        floor: formData.floor || null,
        bay: formData.bay || null,
        station: formData.station || null,
        status: formData.status,
        criticality: formData.criticality as MachineCriticality,
        healthScore: formData.healthScore ?? 100,
        photoFiles: files.photos,
        documentFiles: files.documents,
        warrantyItems: (formData as any).warrantyItems ?? [],
        compatiblePartIds: formData.compatiblePartIds || [],
        modificationNotes: formData.modificationNotes || null,
        additionalNotes: formData.additionalNotes || null,
      };

      await createMachine(payload);
      success(`Machine "${formData.name}" created successfully!`);
      navigate('/app/machines');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create machine';
      showError(errorMsg);
      throw err;
    }
  };

  return (
    <MachineForm
      mode="create"
      siteId={siteId}
      onSubmit={handleSubmit as any}
      isSubmitting={creating}
    />
  );
}
