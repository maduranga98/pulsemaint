import { syncMachineSpareParts } from '../../services/machineSpareParts.service';
import type { SparePartEntry } from '../../lib/machineSpareParts';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMachine } from '../../hooks/useMachine';
import { useMachineUpdate } from '../../hooks/useMachineUpdate';
import { useToast } from '../../hooks/useToast';
import type { UpdateMachinePayload } from '../../types/machine';
import type { UpdateMachineFormData } from '../../schemas/machine';
import { MachineForm } from '../../components/machines/MachineForm';
import { ensureDepartments } from '../../services/departments.service';

import { useTranslation } from 'react-i18next';
export function EditMachinePage() {
  const { t } = useTranslation();
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
        <p className="text-gray-600">{t('common.ui2.machines.editMachinePage.loading')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('common.ui2.machines.editMachinePage.loadingMachine')}</p>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('common.ui2.machines.editMachinePage.machineNotFound')}</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (
    formData: UpdateMachineFormData,
    files: { photos: File[]; documents: Array<{ file: File; type: any; name: string }>; spareParts: SparePartEntry[] | null }
  ) => {
    try {
      const payload: UpdateMachinePayload = {
        siteId,
        machineId: id,
        name: formData.name,
        type: formData.type,
        manufacturer: formData.manufacturer,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || undefined,
        purchaseDate: formData.purchaseDate || null,
        installationDate: formData.installationDate || null,
        nextPmDue: formData.nextPmDue || null,
        expectedLifespanYears: formData.expectedLifespanYears || null,
        ...(formData.purchasePrice !== undefined ? { purchasePrice: formData.purchasePrice } : {}),
        ...(formData.scrapValue !== undefined ? { scrapValue: formData.scrapValue } : {}),
        department: formData.department,
        plantId: formData.plantId ?? undefined,
        floor: formData.floor || null,
        bay: formData.bay || null,
        station: formData.station || null,
        status: formData.status,
        criticality: formData.criticality as any,
        warrantyItems: (formData as any).warrantyItems?.map((w: any) => ({
          partName: w.partName,
          expiryDate: w.expiryDate,
          supplierWarrantyRef: w.supplierWarrantyRef ?? '',
        })),
        photoFiles: files.photos,
        documentFiles: files.documents,
        compatiblePartIds: formData.compatiblePartIds || [],
        modificationNotes: formData.modificationNotes || null,
        additionalNotes: (formData as any).additionalNotes ?? null,
      };

      await updateMachine(payload);
      if (files.spareParts) {
        try {
          await syncMachineSpareParts({
            companyId: userProfile.companyId,
            plantId: formData.plantId ?? machine?.plantId ?? null,
            machineId: id,
            entries: files.spareParts,
            user: { id: userProfile.id, name: userProfile.fullName ?? '', role: userProfile.role },
          });
        } catch (partsErr) {
          console.error('Spare parts could not be saved', partsErr);
          showError(partsErr instanceof Error && partsErr.message.includes('limit') ? `Machine updated, but its spare parts were not added. ${partsErr.message}` : 'Machine updated, but its spare parts could not be saved.');
        }
      }
      // A department typed for this machine becomes one of its plant's departments.
      await ensureDepartments(userProfile.companyId, formData.plantId ?? machine?.plantId, [formData.department]);
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
