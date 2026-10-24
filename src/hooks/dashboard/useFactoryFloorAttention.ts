import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useRecordPlantMatcher } from '../useRecordPlantMatcher';
import { plantConstraints } from '../../lib/plantQuery';
import { FLOOR_WO_STARTED } from '../../lib/factoryFloor';

/** Breakdown statuses that are still "reported" — a machine stays flagged until
 *  its breakdown is resolved / closed / cancelled. */
const BREAKDOWN_DONE = new Set(['resolved', 'closed', 'cancelled']);

export interface FloorMachineWo {
  woNumber: string;
  woType: string;
  status: string;
}

export interface FloorMachine {
  machineId: string;
  machineName: string;
  location: string;
  /** The machine's plant (from its work orders / breakdowns), when stamped. */
  plantId: string | null;
  currentStatus: 'breakdown' | 'maintenance';
  openWoCount: number;
  openBreakdownCount: number;
  wos: FloorMachineWo[];
}

/**
 * The machines with work in progress, computed from work orders and breakdown
 * tickets: any machine with a breakdown that isn't yet resolved, or a work order
 * that has started and isn't yet signed off. Both sources are subscribed
 * (`onSnapshot`), so a machine appears when its work starts (a WO that is only
 * created doesn't count) and disappears once every one of its WOs is signed off
 * and its breakdowns are resolved.
 */
export function useFactoryFloorAttention(companyId: string) {
  const [wos, setWos] = useState<Record<string, unknown>[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, unknown>[]>([]);
  const [woLoading, setWoLoading] = useState(true);
  const [bdLoading, setBdLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Plant-scoped roles (and admin with a plant tab selected) only see their
  // own plant's machines on the floor map.
  const inScopedPlant = useRecordPlantMatcher();

  useEffect(() => {
    if (!companyId) {
      setWoLoading(false);
      return;
    }
    setWoLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId), ...plantConstraints('workOrders')),
      (snap) => {
        setWos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setWoLoading(false);
      },
      (err) => {
        setError(err.message);
        setWoLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setBdLoading(false);
      return;
    }
    setBdLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'breakdown_tickets'), where('companyId', '==', companyId), ...plantConstraints('breakdown_tickets')),
      (snap) => {
        setBreakdowns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setBdLoading(false);
      },
      // A denied/failed breakdown read shouldn't blank the whole map — keep the
      // WO-derived machines.
      () => setBdLoading(false),
    );
    return () => unsub();
  }, [companyId]);

  const machines = useMemo<FloorMachine[]>(() => {
    const byId = new Map<string, FloorMachine>();

    const ensure = (machineId: string, machineName: string, location: string, plantId: string | null): FloorMachine => {
      let m = byId.get(machineId);
      if (!m) {
        m = {
          machineId,
          machineName: machineName || 'Machine',
          location: location || '',
          plantId,
          currentStatus: 'maintenance',
          openWoCount: 0,
          openBreakdownCount: 0,
          wos: [],
        };
        byId.set(machineId, m);
      }
      if (!m.location && location) m.location = location;
      if (!m.plantId && plantId) m.plantId = plantId;
      return m;
    };

    for (const raw of wos) {
      const status = String(raw.status ?? '');
      // Only work that has started, until it is signed off and closed.
      if (!FLOOR_WO_STARTED(status)) continue;
      if (!inScopedPlant(raw as { machinePlantId?: string; machineId?: string })) continue;
      const machineId = String(raw.machineId ?? '');
      if (!machineId) continue;
      const m = ensure(machineId, String(raw.machineName ?? ''), String(raw.machineLocation ?? ''), (raw.machinePlantId as string | undefined) ?? null);
      m.openWoCount += 1;
      m.wos.push({
        woNumber: String(raw.woNumber ?? ''),
        woType: String(raw.woType ?? 'WO'),
        status,
      });
    }

    for (const raw of breakdowns) {
      const status = String(raw.status ?? '');
      if (BREAKDOWN_DONE.has(status)) continue;
      if (!inScopedPlant(raw as { machinePlantId?: string; machineId?: string })) continue;
      const machineId = String(raw.machineId ?? '');
      if (!machineId) continue;
      const m = ensure(machineId, String(raw.machineName ?? ''), String(raw.location ?? ''), (raw.machinePlantId as string | undefined) ?? null);
      m.openBreakdownCount += 1;
      m.currentStatus = 'breakdown';
    }

    return [...byId.values()].sort((a, b) => {
      // Breakdowns first, then by open WO count.
      if (a.currentStatus !== b.currentStatus) return a.currentStatus === 'breakdown' ? -1 : 1;
      return b.openWoCount - a.openWoCount;
    });
  }, [wos, breakdowns, inScopedPlant]);

  return { machines, loading: woLoading || bdLoading, error };
}
