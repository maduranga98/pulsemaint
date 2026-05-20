import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMachineCreate } from '../../hooks/useMachineCreate';
import { useToast } from '../../hooks/useToast';
import type { CreateMachineFormData, CreateMachinePayload } from '../../types/machine';
import { MachineForm } from '../../components/machines/MachineForm';

export function AddMachinePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { createMachine } = useMachineCreate();
  const { success, error: showError } = useToast();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const handleSubmit = async (
    formData: CreateMachineFormData,
    files: { photos: File[]; documents: Array<{ file: File; type: any; name: string }> }
  ) => {
    try {
      const payload: CreateMachinePayload = {
        siteId: user.siteId,
        name: formData.name,
        type: formData.type,
        manufacturer: formData.manufacturer,
        model: formData.model || null,
        serialNumber: formData.serialNumber || null,
        purchaseDate: formData.purchaseDate || null,
        installationDate: formData.installationDate || null,
        expectedLifespanYears: formData.expectedLifespanYears || null,
        department: formData.department,
        floor: formData.floor || null,
        bay: formData.bay || null,
        station: formData.station || null,
        status: formData.status,
        criticality: formData.criticality,
        photoFiles: files.photos,
        documentFiles: files.documents,
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
      siteId={user.siteId}
      onSubmit={handleSubmit}
    />
  );
}
