import { useState } from 'react';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';
import TechnicianCard from './TechnicianCard';
import TechnicianDetailModal from './TechnicianDetailModal';

interface TechnicianGridProps {
  technicians: ContractorTechnician[];
}

export function TechnicianGrid({ technicians }: TechnicianGridProps) {
  const [selected, setSelected] = useState<ContractorTechnician | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {technicians.length ? technicians.map((technician) => (
          <TechnicianCard key={technician.id} technician={technician} onView={setSelected} />
        )) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 sm:col-span-2 xl:col-span-3">No technicians registered.</div>
        )}
      </div>
      <TechnicianDetailModal technician={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default TechnicianGrid;
