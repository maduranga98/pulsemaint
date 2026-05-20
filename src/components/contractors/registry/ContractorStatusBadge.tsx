import { Ban, CheckCircle2, CircleDashed } from 'lucide-react';
import type { ContractorStatus } from '@/lib/contractors/contractorTypes';

interface ContractorStatusBadgeProps {
  status: ContractorStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function ContractorStatusBadge({ status, size = 'md' }: ContractorStatusBadgeProps) {
  const config = {
    active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
    inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-600 border-slate-200', Icon: CircleDashed },
    blacklisted: { label: 'Blacklisted', className: 'bg-red-50 text-red-700 border-red-200', Icon: Ban },
  }[status];
  const textSize = size === 'lg' ? 'text-sm px-3 py-1.5' : size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${textSize} ${config.className}`}>
      <config.Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {config.label}
    </span>
  );
}

export default ContractorStatusBadge;
