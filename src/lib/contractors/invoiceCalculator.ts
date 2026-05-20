import type { Contractor, ContractorJob } from './contractorTypes';

export interface SystemInvoice {
  laborHours: number;
  laborRate: number;
  laborCost: number;
  partsCost: number;
  emergencyFee: number;
  subtotal: number;
  minimumChargeApplied: boolean;
  total: number;
}

export interface InvoiceVariance {
  amount: number;
  percent: number;
  flagged: boolean;
  direction: 'over' | 'under' | 'match';
}

export function calculateSystemInvoice(
  job: ContractorJob,
  contractor: Pick<
    Contractor,
    'standardLaborRate' | 'overtimeRate' | 'emergencyCallOutFee' | 'minimumCharge'
  >,
  options: { overtime?: boolean; emergencyCallout?: boolean } = {},
): SystemInvoice {
  const laborHours = Number(((job.actualWorkDurationMinutes ?? 0) / 60).toFixed(2));
  const standardRate = contractor.standardLaborRate ?? 0;
  const laborRate = options.overtime ? contractor.overtimeRate ?? standardRate : standardRate;
  const laborCost = Number((laborHours * laborRate).toFixed(2));
  const partsCost = Number(
    (job.partsFromFactory ?? []).reduce((sum, part) => sum + (part.totalCost ?? 0), 0).toFixed(2),
  );
  const emergencyFee = options.emergencyCallout ? contractor.emergencyCallOutFee ?? 0 : 0;
  const subtotal = Number((laborCost + partsCost + emergencyFee).toFixed(2));
  const minimum = contractor.minimumCharge ?? 0;
  const minimumChargeApplied = subtotal < minimum;
  const total = minimumChargeApplied ? minimum : subtotal;

  return {
    laborHours,
    laborRate,
    laborCost,
    partsCost,
    emergencyFee,
    subtotal,
    minimumChargeApplied,
    total,
  };
}

export function calculateVariance(systemTotal: number, contractorTotal: number): InvoiceVariance {
  const amount = Math.abs(contractorTotal - systemTotal);
  const percent = systemTotal > 0 ? (amount / systemTotal) * 100 : contractorTotal > 0 ? 100 : 0;
  const direction = contractorTotal === systemTotal ? 'match' : contractorTotal > systemTotal ? 'over' : 'under';

  return {
    amount: Number(amount.toFixed(2)),
    percent: Number(percent.toFixed(2)),
    flagged: percent > 10,
    direction,
  };
}

export function formatLkr(value: number | null | undefined): string {
  return `LKR ${(value ?? 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
