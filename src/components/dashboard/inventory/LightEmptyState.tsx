import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LightEmptyStateProps {
  message?: string;
  subMessage?: string;
}

export default function LightEmptyState({
  message,
  subMessage,
}: LightEmptyStateProps) {
  const { t } = useTranslation();
  const resolvedMessage = message ?? t('common.widgets.common.noDataAvailable');
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-700">{resolvedMessage}</p>
      {subMessage && <p className="text-sm text-gray-500 mt-1">{subMessage}</p>}
    </div>
  );
}
