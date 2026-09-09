import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';
import TechnicianCard from './TechnicianCard';
import TechnicianDetailModal from './TechnicianDetailModal';

interface TechnicianGridProps {
  technicians: ContractorTechnician[];
  contractorId?: string;
  canManage?: boolean;
}

export function TechnicianGrid({ technicians, contractorId, canManage }: TechnicianGridProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ContractorTechnician | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {technicians.length ? technicians.map((technician) => (
          <TechnicianCard
            key={technician.id}
            technician={technician}
            contractorId={contractorId}
            canManage={canManage}
            onView={setSelected}
          />
        )) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 sm:col-span-2 xl:col-span-3">{t('common.contractors.technicians.grid.empty')}</div>
        )}
      </div>
      <TechnicianDetailModal technician={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default TechnicianGrid;
