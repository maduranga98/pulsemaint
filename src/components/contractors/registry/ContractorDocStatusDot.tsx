import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface ContractorDocStatusDotProps {
  status: 'valid' | 'expiring' | 'expired';
  label?: string;
}

export function ContractorDocStatusDot({ status, label }: ContractorDocStatusDotProps) {
  const config = {
    valid: { Icon: CheckCircle2, className: 'text-emerald-600', text: 'Documents valid' },
    expiring: { Icon: Clock, className: 'text-amber-600', text: 'Expiring soon' },
    expired: { Icon: AlertCircle, className: 'text-red-600', text: 'Expired documents' },
  }[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
      <config.Icon className={`h-4 w-4 ${config.className}`} />
      {label ?? config.text}
    </span>
  );
}

export default ContractorDocStatusDot;
