import { Mail, MessageCircle, Phone } from 'lucide-react';
import type { Contractor } from '@/lib/contractors/contractorTypes';

interface ContractorQuickContactBarProps {
  contractor: Contractor;
}

export function ContractorQuickContactBar({ contractor }: ContractorQuickContactBarProps) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3">
      <a className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700" href={`tel:${contractor.primaryPhone}`}>
        <Phone className="h-4 w-4 text-blue-600" />
        {contractor.primaryPhone}
      </a>
      <a className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700" href={`mailto:${contractor.primaryEmail}`}>
        <Mail className="h-4 w-4 text-blue-600" />
        {contractor.primaryEmail}
      </a>
      <a className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700" href={`https://wa.me/${contractor.whatsappNumber ?? contractor.primaryPhone}`}>
        <MessageCircle className="h-4 w-4 text-emerald-600" />
        {contractor.whatsappNumber || contractor.primaryPhone}
      </a>
    </div>
  );
}

export default ContractorQuickContactBar;
