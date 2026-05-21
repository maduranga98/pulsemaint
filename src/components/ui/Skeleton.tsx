interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-slate-200/70 rounded ${className}`} />;
}

interface SkeletonListProps {
  rows?: number;
  rowClassName?: string;
}

export function SkeletonList({ rows = 4, rowClassName = 'h-16' }: SkeletonListProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={rowClassName} />
      ))}
    </div>
  );
}
