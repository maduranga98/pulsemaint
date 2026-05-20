import type { PartUnit } from '@/types/inventory';

interface UnitLabelProps {
  unit: PartUnit;
  quantity?: number;
  className?: string;
}

export function UnitLabel({ unit, quantity, className = '' }: UnitLabelProps) {
  if (quantity === undefined) {
    return <span className={className}>{unit}</span>;
  }

  // Format quantity: show decimal only when needed
  const formatted =
    Number.isInteger(quantity)
      ? quantity.toLocaleString()
      : quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <span className={className}>
      {formatted} {unit}
    </span>
  );
}
