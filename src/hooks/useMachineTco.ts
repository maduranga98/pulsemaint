import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import type { WorkOrder } from '../types/workOrder';

const COMPLETED_WO_STATUSES = ['COMPLETED', 'SIGNED_OFF', 'CLOSED'];

/** Replacement threshold: cumulative repairs above this fraction of the
 *  replacement value triggers a replacement recommendation. */
export const REPLACEMENT_RECOMMENDATION_RATIO = 0.6;

export interface RepairTrendPoint {
  month: string; // YYYY-MM
  label: string; // e.g. "Jan 25"
  cost: number;
}

export interface MachineTcoSummary {
  machineId: string;
  machineName: string;
  purchasePrice: number | null;
  replacementValue: number | null;
  cumulativeMaintenanceSpend: number;
  partsSpend: number;
  labourSpend: number;
  workOrderCount: number;
  /** cumulative spend / replacement value (0–1+), or null when unknown. */
  spendRatio: number | null;
  replacementRecommended: boolean;
}

/** Sum of parts + labour cost for one work order. Mirrors analyticsAggregation. */
export function workOrderCost(wo: any): { parts: number; labour: number } {
  const parts = Array.isArray(wo.partsUsed)
    ? wo.partsUsed.reduce((s: number, p: any) => s + Number(p.totalCost ?? 0), 0)
    : 0;
  const labour = Array.isArray(wo.technicianWorkLogs)
    ? wo.technicianWorkLogs.reduce(
        (s: number, l: any) => s + Number(l.laborCost ?? l.labourCost ?? 0),
        0,
      )
    : 0;
  const contractor = Number(wo.contractorHoursLog?.hoursBilled ?? 0) > 0
    ? Number(wo.contractorHoursLog?.amountBilled ?? wo.contractorHoursLog?.totalCost ?? 0)
    : 0;
  return { parts, labour: labour + contractor };
}

function woCompletedDate(wo: any): Date | null {
  const ts = wo.actualEndTime ?? wo.closedAt ?? wo.updatedAt;
  if (ts?.toDate) return ts.toDate();
  return null;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/** Per-machine TCO: cumulative spend + monthly repair-cost trend. */
export function useMachineTco(machineId: string | null | undefined, machine?: {
  name?: string;
  purchasePrice?: number | null;
  replacementValue?: number | null;
}) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!machineId || !companyId) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'workOrders'),
      where('companyId', '==', companyId),
      where('machineId', '==', machineId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWorkOrders(snap.docs.map((d) => ({ ...d.data(), id: d.id } as WorkOrder)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [machineId, companyId]);

  const { summary, trend } = useMemo(() => {
    const completed = workOrders.filter((wo) => COMPLETED_WO_STATUSES.includes(wo.status));
    let parts = 0;
    let labour = 0;
    const byMonth = new Map<string, number>();

    for (const wo of completed) {
      const c = workOrderCost(wo);
      parts += c.parts;
      labour += c.labour;
      const d = woCompletedDate(wo);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(key, (byMonth.get(key) ?? 0) + c.parts + c.labour);
      }
    }

    const cumulative = parts + labour;
    const replacementValue = machine?.replacementValue ?? null;
    const spendRatio =
      replacementValue && replacementValue > 0 ? cumulative / replacementValue : null;

    const trendPoints: RepairTrendPoint[] = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cost]) => {
        const [y, m] = month.split('-').map(Number);
        return { month, label: monthLabel(new Date(y, m - 1, 1)), cost: Math.round(cost) };
      });

    const s: MachineTcoSummary = {
      machineId: machineId ?? '',
      machineName: machine?.name ?? '',
      purchasePrice: machine?.purchasePrice ?? null,
      replacementValue,
      cumulativeMaintenanceSpend: Math.round(cumulative),
      partsSpend: Math.round(parts),
      labourSpend: Math.round(labour),
      workOrderCount: completed.length,
      spendRatio,
      replacementRecommended: spendRatio !== null && spendRatio >= REPLACEMENT_RECOMMENDATION_RATIO,
    };

    return { summary: s, trend: trendPoints };
  }, [workOrders, machine?.name, machine?.purchasePrice, machine?.replacementValue, machineId]);

  return { summary, trend, loading };
}
