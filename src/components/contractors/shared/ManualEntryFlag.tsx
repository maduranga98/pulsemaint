import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ManualEntryFlagProps {
  contractorName: string;
}

export function ManualEntryFlag({ contractorName }: ManualEntryFlagProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {t('common.contractors.shared.manualEntryFlag.notRegistered', { contractorName })}
      </span>
      <Link to="/app/contractors/new" className="font-semibold text-amber-900 underline">
        {t('common.contractors.shared.manualEntryFlag.registerNow')}
      </Link>
    </div>
  );
}

export default ManualEntryFlag;
