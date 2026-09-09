import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ContractorDocStatusDotProps {
  status: 'valid' | 'expiring' | 'expired';
  label?: string;
}

export function ContractorDocStatusDot({ status, label }: ContractorDocStatusDotProps) {
  const { t } = useTranslation();
  const configs = {
    valid: { Icon: CheckCircle2, className: 'text-emerald-600', text: t('common.contractors.registry.docStatusDot.valid') },
    expiring: { Icon: Clock, className: 'text-amber-600', text: t('common.contractors.registry.docStatusDot.expiring') },
    expired: { Icon: AlertCircle, className: 'text-red-600', text: t('common.contractors.registry.docStatusDot.expired') },
  };
  const config = configs[status] ?? configs.valid;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
      <config.Icon className={`h-4 w-4 ${config.className}`} />
      {label ?? config.text}
    </span>
  );
}

export default ContractorDocStatusDot;
