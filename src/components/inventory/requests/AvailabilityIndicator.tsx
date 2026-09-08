import { useTranslation } from 'react-i18next';

interface AvailabilityIndicatorProps {
  available: number;
  requested: number;
}

export function AvailabilityIndicator({ available, requested }: AvailabilityIndicatorProps) {
  const { t } = useTranslation();

  if (available === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
        <span className="text-base">✗</span>
        <span>{t('common.inventory.requests.availabilityIndicator.outOfStock')}</span>
      </span>
    );
  }

  if (available >= requested) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
        <span className="text-base">✓</span>
        <span>{t('common.inventory.requests.availabilityIndicator.available', { count: available })}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-amber-600 text-sm font-medium">
      <span className="text-base">⚠</span>
      <span>{t('common.inventory.requests.availabilityIndicator.partial', { available, requested })}</span>
    </span>
  );
}
