import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { fetchHandoverById } from '@/services/handover.service';
import type { ShiftHandover } from '@/types/handover.types';
import HandoverDetailView from '@/components/handover/HandoverDetailView';

export function HandoverDetailPage() {
  const { id } = useParams();
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [handover, setHandover] = useState<ShiftHandover | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id && companyId) void fetchHandoverById(companyId, id).then(setHandover);
  }, [companyId, id]);

  const handleExportPdf = () => {
    window.print();
  };

  if (!handover) return <div className="p-6 text-slate-500">Loading handover...</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex justify-end print:hidden">
        <button type="button" onClick={handleExportPdf} className="min-h-12 rounded-md bg-blue-600 px-4 text-sm font-bold text-white">Export PDF</button>
      </div>
      <div ref={printRef}>
        <HandoverDetailView handover={handover} />
      </div>
    </div>
  );
}

export default HandoverDetailPage;
