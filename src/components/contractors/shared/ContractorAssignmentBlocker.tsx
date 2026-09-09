import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ContractorAssignmentBlockerProps {
  reason?: string;
}

export function ContractorAssignmentBlocker({ reason }: ContractorAssignmentBlockerProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{t('common.contractors.shared.assignmentBlocker.title')}</p>
          <p>{reason ?? t('common.contractors.shared.assignmentBlocker.defaultReason')} {t('common.contractors.shared.assignmentBlocker.renewPrompt')}</p>
        </div>
      </div>
    </div>
  );
}

export default ContractorAssignmentBlocker;
