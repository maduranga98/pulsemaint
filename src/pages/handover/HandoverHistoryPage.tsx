import { useState } from 'react';
import HandoverFilterBar from '@/components/handover/HandoverFilterBar';
import HandoverHistoryCard from '@/components/handover/HandoverHistoryCard';
import HandoverHistoryTable from '@/components/handover/HandoverHistoryTable';
import { useHandoverHistory } from '@/hooks/useHandoverHistory';
import type { HandoverHistoryFilters } from '@/types/handover.types';

const initialFilters: HandoverHistoryFilters = {
  dateFrom: null,
  dateTo: null,
  supervisorName: '',
  shiftName: '',
  department: '',
};

export function HandoverHistoryPage() {
  const [filters, setFilters] = useState(initialFilters);
  const { handoverHistory } = useHandoverHistory(filters);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="font-[Sora] text-2xl font-bold text-slate-950">Handover History</h1>
        <p className="mt-1 text-sm text-slate-500">Timestamped archive of supervisor accountability transfers.</p>
      </div>
      <HandoverFilterBar filters={filters} onChange={setFilters} />
      <div className="grid gap-3 lg:hidden">
        {handoverHistory.map((handover) => <HandoverHistoryCard key={handover.id} handover={handover} />)}
      </div>
      <div className="hidden lg:block"><HandoverHistoryTable handovers={handoverHistory} /></div>
      {!handoverHistory.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No handovers found.</div>}
    </div>
  );
}

export default HandoverHistoryPage;
