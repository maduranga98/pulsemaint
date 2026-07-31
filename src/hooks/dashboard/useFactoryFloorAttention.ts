import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/** WO statuses that still need attention on the floor — everything up to and
 *  including completion (a completed WO still awaits the supervisor's sign-off).
 *  Once signed off / closed / cancelled a WO drops off the map. */
const WO_ATTENTION_STATUSES = new Set([
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD_PARTS',
  'ON_HOLD_APPROVAL',
  'COMPLETED',
]);

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
  currentStatus: 'breakdown' | 'maintenance';
  openWoCount: number;
  openBreakdownCount: number;
  wos: FloorMachineWo[];
}

/**
 * The machines a supervisor is actively driving, computed live from work orders
 * and breakdown tickets: any machine with a work order that isn't yet signed
 * off, or a breakdown that isn't yet resolved. Both sources are live
 * (`onSnapshot`), so a machine appears the moment a WO/breakdown is raised and
 * disappears automatically once every one of its WOs is signed off and its
 * breakdowns are resolved.
 */
export function useFactoryFloorAttention(companyId: string) {
  const [wos, setWos] = useState<Record<string, unknown>[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, unknown>[]>([]);
  const [woLoading, setWoLoading] = useState(true);
  const [bdLoading, setBdLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setWoLoading(false);
      return;
    }
    setWoLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId)),
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
      query(collection(db, 'breakdown_tickets'), where('companyId', '==', companyId)),
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

    const ensure = (machineId: string, machineName: string, location: string): FloorMachine => {
      let m = byId.get(machineId);
      if (!m) {
        m = {
          machineId,
          machineName: machineName || 'Machine',
          location: location || '',
          currentStatus: 'maintenance',
          openWoCount: 0,
          openBreakdownCount: 0,
          wos: [],
        };
        byId.set(machineId, m);
      }
      if (!m.location && location) m.location = location;
      return m;
    };

    for (const raw of wos) {
      const status = String(raw.status ?? '');
      if (!WO_ATTENTION_STATUSES.has(status)) continue;
      const machineId = String(raw.machineId ?? '');
      if (!machineId) continue;
      const m = ensure(machineId, String(raw.machineName ?? ''), String(raw.machineLocation ?? ''));
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
      const machineId = String(raw.machineId ?? '');
      if (!machineId) continue;
      const m = ensure(machineId, String(raw.machineName ?? ''), String(raw.location ?? ''));
      m.openBreakdownCount += 1;
      m.currentStatus = 'breakdown';
    }

    return [...byId.values()].sort((a, b) => {
      // Breakdowns first, then by open WO count.
      if (a.currentStatus !== b.currentStatus) return a.currentStatus === 'breakdown' ? -1 : 1;
      return b.openWoCount - a.openWoCount;
    });
  }, [wos, breakdowns]);

  return { machines, loading: woLoading || bdLoading, error };
}
