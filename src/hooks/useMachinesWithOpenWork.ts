import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Kept in step with src/lib/machineOperationalStatus.ts.
const CLOSED_BREAKDOWN_STATUSES = new Set(['resolved', 'closed', 'cancelled']);
const TERMINAL_WO_STATUSES = new Set(['SIGNED_OFF', 'CLOSED', 'CANCELLED']);

export interface MachinesWithOpenWork {
  /** Machines with at least one open breakdown or unsigned-off work order. */
  openMachineIds: Set<string>;
  /** True once both sources loaded successfully — only then can "no open
   *  work" be trusted (a role that can't read work orders never gets here). */
  complete: boolean;
}

/**
 * Live set of machines that currently have open maintenance work — used to
 * show a machine's operational status from its actual breakdowns / work
 * orders, so the registry reads correctly even when the stored `status`
 * field lags (older open tickets, a failed status write, functions not yet
 * deployed).
 */
export function useMachinesWithOpenWork(companyId: string | undefined): MachinesWithOpenWork {
  const [breakdownIds, setBreakdownIds] = useState<Set<string>>(new Set());
  const [woIds, setWoIds] = useState<Set<string>>(new Set());
  const [bdOk, setBdOk] = useState(false);
  const [woOk, setWoOk] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const unsubBd = onSnapshot(
      query(collection(db, 'breakdown_tickets'), where('companyId', '==', companyId)),
      (snap) => {
        const ids = new Set<string>();
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.machineId && !CLOSED_BREAKDOWN_STATUSES.has(String(data.status ?? ''))) ids.add(String(data.machineId));
        });
        setBreakdownIds(ids);
        setBdOk(true);
      },
      () => setBdOk(false),
    );
    const unsubWo = onSnapshot(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId)),
      (snap) => {
        const ids = new Set<string>();
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.machineId && !TERMINAL_WO_STATUSES.has(String(data.status ?? ''))) ids.add(String(data.machineId));
        });
        setWoIds(ids);
        setWoOk(true);
      },
      // Roles that can only read their own work orders are denied here —
      // breakdowns still drive the status for them.
      () => setWoOk(false),
    );
    return () => {
      unsubBd();
      unsubWo();
    };
  }, [companyId]);

  return useMemo(
    () => ({ openMachineIds: new Set([...breakdownIds, ...woIds]), complete: bdOk && woOk }),
    [breakdownIds, woIds, bdOk, woOk],
  );
}

/**
 * A machine's status as it should read now: under maintenance while it has
 * open work, active again once all of it is closed/signed off. Decommissioned
 * machines are never changed.
 */
export function effectiveMachineStatus<S extends string>(
  machine: { id: string; status: S },
  open: MachinesWithOpenWork,
): S | 'active' | 'under_maintenance' {
  if (machine.status === 'decommissioned') return machine.status;
  if (open.openMachineIds.has(machine.id)) return 'under_maintenance';
  if (machine.status === 'under_maintenance' && open.complete) return 'active';
  return machine.status;
}
