import { clsx } from '../../../lib/utils';

interface LoadingSkeletonProps {
  variant?: 'kpi' | 'chart' | 'table' | 'kanban' | 'card';
  className?: string;
}

export default function LoadingSkeleton({ variant = 'card', className }: LoadingSkeletonProps) {
  if (variant === 'kpi') {
    return (
      <div className={clsx('bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 animate-pulse space-y-3', className)}>
        <div className="h-3 bg-[#1E3A5F] rounded w-1/3" />
        <div className="h-10 bg-[#1E3A5F] rounded w-1/2" />
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={clsx('bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 animate-pulse', className)}>
        <div className="h-3 bg-[#1E3A5F] rounded w-1/4 mb-4" />
        <div className="h-48 bg-[#1E3A5F] rounded" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={clsx('bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 animate-pulse space-y-3', className)}>
        <div className="h-3 bg-[#1E3A5F] rounded w-1/4 mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 bg-[#1E3A5F] rounded w-full" />
        ))}
      </div>
    );
  }

  if (variant === 'kanban') {
    return (
      <div className={clsx('flex gap-4 overflow-x-auto', className)}>
        {[1, 2, 3].map((col) => (
          <div key={col} className="min-w-[280px] space-y-3">
            <div className="h-6 bg-[#1E3A5F] rounded w-24 animate-pulse" />
            {[1, 2, 3].map((card) => (
              <div key={card} className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 h-28 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 animate-pulse space-y-3', className)}>
      <div className="h-3 bg-[#1E3A5F] rounded w-1/3" />
      <div className="h-20 bg-[#1E3A5F] rounded" />
    </div>
  );
}
