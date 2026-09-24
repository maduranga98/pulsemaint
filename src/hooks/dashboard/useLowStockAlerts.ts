import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, type Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDepartmentScope } from '../useDepartmentScope';

export type LowStockAlertStatus = 'out_of_stock' | 'low_now' | 'restocked';

export interface LowStockAlertRow {
  partId: string;
  partNumber: string;
  name: string;
  currentStock: number;
  minStockLevel: number;
  /** Lowest stock level the part reached in the period (or now). */
  lowestInPeriod: number;
  /** When it most recently hit its minimum in the period (null: low since before the period). */
  lastAlertAt: Date | null;
  /** Times it dropped to or below its minimum in the period (1 if it was already low when the period began). */
  alertCount: number;
  status: LowStockAlertStatus;
}

interface PartRow {
  id: string;
  partNumber: string;
  name: string;
  currentStock: number;
  minStockLevel: number;
  plantId: string | null;
}

interface MovementRow {
  partId: string;
  quantityBefore: number;
  quantityAfter: number;
  performedAt: Date | null;
}

/**
 * Every part that was at or below its minimum stock during the last
 * `windowDays` days — both parts that are low right now and parts that hit
 * their minimum in the period and have since been restocked — so the Low
 * Stock tab reflects the alerts raised in the selected period, not only the
 * current snapshot. Derived from stock-movement history against each part's
 * minimum; scoped to the caller's plant.
 */
export function useLowStockAlerts(companyId: string, windowDays: number) {
  const { plantId } = useDepartmentScope();
  const [parts, setParts] = useState<PartRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [movesLoading, setMovesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setPartsLoading(false);
      return;
    }
    return onSnapshot(
      query(collection(db, 'inventoryParts'), where('companyId', '==', companyId)),
      (snap) => {
        setParts(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              partNumber: String(data.partNumber ?? ''),
              name: String(data.name ?? 'Unknown part'),
              currentStock: Number(data.currentStock ?? 0),
              minStockLevel: Number(data.minStockLevel ?? 0),
              plantId: (data.plantId as string | null | undefined) ?? null,
            };
          }),
        );
        setPartsLoading(false);
      },
      (err) => {
        setError(err.message);
        setPartsLoading(false);
      },
    );
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setMovesLoading(false);
      return;
    }
    // Filtered by date client-side — a companyId + performedAt range query
    // would need a composite index.
    return onSnapshot(
      query(collection(db, 'stockMovements'), where('companyId', '==', companyId)),
      (snap) => {
        setMovements(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              partId: String(data.partId ?? ''),
              quantityBefore: Number(data.quantityBefore ?? NaN),
              quantityAfter: Number(data.quantityAfter ?? NaN),
              performedAt: (data.performedAt as Timestamp | undefined)?.toDate?.() ?? null,
            };
          }),
        );
        setMovesLoading(false);
      },
      (err) => {
        setError(err.message);
        setMovesLoading(false);
      },
    );
  }, [companyId]);

  const rows = useMemo<LowStockAlertRow[]>(() => {
    const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const byPart = new Map<string, MovementRow[]>();
    movements.forEach((m) => {
      if (!m.performedAt || m.performedAt.getTime() < since || Number.isNaN(m.quantityAfter)) return;
      byPart.set(m.partId, [...(byPart.get(m.partId) ?? []), m]);
    });

    const out: LowStockAlertRow[] = [];
    parts
      .filter((p) => !plantId || p.plantId === plantId)
      .filter((p) => p.minStockLevel > 0)
      .forEach((p) => {
        const lowMoves = (byPart.get(p.id) ?? []).filter((m) => m.quantityAfter <= p.minStockLevel);
        const lowNow = p.currentStock <= p.minStockLevel;
        if (!lowNow && lowMoves.length === 0) return;
        const lowest = Math.min(p.currentStock, ...lowMoves.map((m) => m.quantityAfter));
        // An alert is a drop from above the minimum to at/below it.
        const crossings = lowMoves.filter(
          (m) => Number.isNaN(m.quantityBefore) || m.quantityBefore > p.minStockLevel,
        ).length;
        const lastAlert = lowMoves.reduce<Date | null>(
          (latest, m) => (!latest || (m.performedAt && m.performedAt > latest) ? m.performedAt : latest),
          null,
        );
        out.push({
          partId: p.id,
          partNumber: p.partNumber,
          name: p.name,
          currentStock: p.currentStock,
          minStockLevel: p.minStockLevel,
          lowestInPeriod: Math.max(0, lowest),
          lastAlertAt: lastAlert,
          alertCount: Math.max(crossings, 1),
          status: p.currentStock <= 0 ? 'out_of_stock' : lowNow ? 'low_now' : 'restocked',
        });
      });

    // Most-alerted first; ties: out of stock, then still low, then restocked.
    const rank: Record<LowStockAlertStatus, number> = { out_of_stock: 0, low_now: 1, restocked: 2 };
    return out.sort((a, b) => b.alertCount - a.alertCount || rank[a.status] - rank[b.status]);
  }, [parts, movements, plantId, windowDays]);

  return { rows, loading: partsLoading || movesLoading, error };
}
