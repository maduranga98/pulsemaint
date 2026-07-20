import type { PartCategory } from '@/types/inventory';

interface CategoryBadgeProps {
  category: PartCategory;
  size?: 'sm' | 'md' | 'lg';
}

const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  electrical: { label: 'Electrical', color: 'text-blue-700', bg: 'bg-blue-50' },
  mechanical: { label: 'Mechanical', color: 'text-slate-700', bg: 'bg-slate-100' },
  hydraulic: { label: 'Hydraulic', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  pneumatic: { label: 'Pneumatic', color: 'text-sky-700', bg: 'bg-sky-100' },
  automation: { label: 'Automation', color: 'text-violet-700', bg: 'bg-violet-50' },
  civil: { label: 'Civil', color: 'text-amber-700', bg: 'bg-amber-50' },
};

const fallbackConfig = { color: 'text-gray-600', bg: 'bg-gray-100' };

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const config = categoryConfig[category] ?? { ...fallbackConfig, label: category };

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}
