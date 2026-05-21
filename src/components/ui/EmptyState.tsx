import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 border border-dashed border-slate-200 rounded-lg bg-white">
      {icon && <div className="text-slate-400 mb-3">{icon}</div>}
      <p className="text-[13px] font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="text-[12px] text-slate-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
