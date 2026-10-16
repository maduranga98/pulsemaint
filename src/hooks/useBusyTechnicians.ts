import { useEffect, useState } from 'react';
import type { BusyInfo } from '../lib/breakdownWorkflow';
import { fetchBusyTechnicians } from '../services/technicianAvailability.service';

const EMPTY = new Map<string, BusyInfo>();

/**
 * Who is mid-job, for pickers that offer technicians to assign. Read once
 * when the picker mounts (and again if its inputs change) — see
 * `fetchBusyTechnicians`.
 */
export function useBusyTechnicians(
  siteId: string | undefined,
  opts: { ignoreBreakdownIds?: string[]; allowMachineId?: string | null } = {},
): { busy: Map<string, BusyInfo>; loading: boolean } {
  const [busy, setBusy] = useState<Map<string, BusyInfo>>(EMPTY);
  const [loading, setLoading] = useState(!!siteId);
  const ignoreKey = (opts.ignoreBreakdownIds ?? []).join(',');
  const allowMachineId = opts.allowMachineId ?? null;

  useEffect(() => {
    if (!siteId) {
      setBusy(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchBusyTechnicians({
      siteId,
      ignoreBreakdownIds: ignoreKey ? ignoreKey.split(',') : [],
      allowMachineId,
    })
      .then((m) => !cancelled && setBusy(m))
      .catch(() => !cancelled && setBusy(EMPTY))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [siteId, ignoreKey, allowMachineId]);

  return { busy, loading };
}
