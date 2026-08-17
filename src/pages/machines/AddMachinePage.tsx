import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useMachineCreate } from '../../hooks/useMachineCreate';
import { useToast } from '../../hooks/useToast';
import type { CreateMachineFormData } from '../../schemas/machine';
import type { CreateMachinePayload, MachineCriticality } from '../../types/machine';
import { MachineForm } from '../../components/machines/MachineForm';

export function AddMachinePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const { createMachine, creating } = useMachineCreate();
  const { success, error: showError } = useToast();

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('common.machines.addPage.loading')}</p>
      </div>
    );
  }

  const siteId = userProfile.siteIds[0] || userProfile.companyId;

  const handleSubmit = async (
    formData: CreateMachineFormData,
    files: { photos: File[]; documents: Array<{ file: File; type: any; name: string }> }
  ) => {
    try {
      const payload: CreateMachinePayload = {
        siteId,
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
      success(t('common.machines.addPage.createSuccess', { name: formData.name }));
      navigate('/app/machines');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('common.machines.addPage.createFailed');
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
