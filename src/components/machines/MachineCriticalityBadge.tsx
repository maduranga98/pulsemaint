import { useTranslation } from 'react-i18next';
import type { MachineCriticality } from '../../types/machine';

interface MachineCriticalityBadgeProps {
  criticality: MachineCriticality;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const criticalityConfig: Record<MachineCriticality, { labelKey: string; color: string; bg: string }> = {
  1: { labelKey: 'common.machines.criticalityBadge.low', color: 'text-blue-600', bg: 'bg-blue-50' },
  2: { labelKey: 'common.machines.criticalityBadge.belowAverage', color: 'text-green-600', bg: 'bg-green-50' },
  3: { labelKey: 'common.machines.criticalityBadge.medium', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  4: { labelKey: 'common.machines.criticalityBadge.high', color: 'text-amber-600', bg: 'bg-amber-50' },
  5: { labelKey: 'common.machines.criticalityBadge.missionCritical', color: 'text-red-600', bg: 'bg-red-50' },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function MachineCriticalityBadge({
  criticality,
  showLabel = true,
  size = 'md',
}: MachineCriticalityBadgeProps) {
  const { t } = useTranslation();
  const config = criticalityConfig[criticality];

  if (!showLabel) {
    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i < criticality ? config.color : 'text-gray-300'}`}
            style={{ backgroundColor: i < criticality ? getColor(criticality) : '#e5e7eb' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      {t(config.labelKey)}
    </div>
  );
}

function getColor(criticality: MachineCriticality): string {
  const colors = {
    1: '#2563eb',
    2: '#10b981',
    3: '#00c2ff',
    4: '#f59e0b',
    5: '#ef4444',
  };
  return colors[criticality];
}
