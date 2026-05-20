interface AvailabilityIndicatorProps {
  available: number;
  requested: number;
}

export function AvailabilityIndicator({ available, requested }: AvailabilityIndicatorProps) {
  if (available === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
        <span className="text-base">✗</span>
        <span>Out of stock</span>
      </span>
    );
  }

  if (available >= requested) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
        <span className="text-base">✓</span>
        <span>Available ({available})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-amber-600 text-sm font-medium">
      <span className="text-base">⚠</span>
      <span>Partial ({available}/{requested})</span>
    </span>
  );
}
