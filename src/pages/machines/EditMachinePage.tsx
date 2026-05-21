import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMachine } from '../../hooks/useMachine';
import { useMachineUpdate } from '../../hooks/useMachineUpdate';
import { useToast } from '../../hooks/useToast';
import type { UpdateMachineFormData, UpdateMachinePayload } from '../../types/machine';
import { MachineForm } from '../../components/machines/MachineForm';

export function EditMachinePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userProfile = useAuthStore((state) => state.userProfile);
  const { updateMachine } = useMachineUpdate();
  const { success, error: showError } = useToast();

  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';
  const { machine, loading, error } = useMachine({ siteId, machineId: id ?? '' });

  if (!userProfile || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading machine...</p>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Machine Not Found</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (
    formData: UpdateMachineFormData,
    files: { photos: File[]; documents: Array<{ file: File; type: any; name: string }> }
  ) => {
    try {
      const payload: UpdateMachinePayload = {
        siteId,
        machineId: id,
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
      };

      await updateMachine(payload);
      success('Machine updated successfully!');
      navigate(`/app/machines/${id}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update machine';
      showError(errorMsg);
      throw err;
    }
  };

  return (
    <MachineForm
      mode="edit"
      initialData={machine}
      siteId={siteId}
      onSubmit={handleSubmit}
    />
  );
}
