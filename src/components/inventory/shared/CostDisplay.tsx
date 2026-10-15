import { useAuthStore } from '@/store/authStore';
import { getCompanyCurrency } from '@/lib/currency';

interface CostDisplayProps {
  amount: number;
  hideFromRole?: boolean;
  className?: string;
}

export function CostDisplay({ amount, hideFromRole = true, className = '' }: CostDisplayProps) {
  const isTechnician = useAuthStore((s) => s.isTechnician);

  if (hideFromRole && isTechnician) {
    return <span className={`text-gray-400 ${className}`}>—</span>;
  }

  const formatted = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return <span className={className}>{getCompanyCurrency()} {formatted}</span>;
}
