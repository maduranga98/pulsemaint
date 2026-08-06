import type { Breakdown } from '../../types/breakdown';

export interface MachineBreakdownGroup {
  machineId: string;
  machineName: string;
  machineLocation: string;
  tickets: Breakdown[];
}

/** Groups a flat list of breakdown tickets by machine, newest-reported first — same grouping the Breakdowns page uses so a machine with several open tickets reads as one row. */
export function groupBreakdownsByMachine(tickets: Breakdown[]): MachineBreakdownGroup[] {
  const byMachine = new Map<string, MachineBreakdownGroup>();
  for (const t of tickets) {
    const existing = byMachine.get(t.machineId);
    if (existing) {
      existing.tickets.push(t);
    } else {
      byMachine.set(t.machineId, {
        machineId: t.machineId,
        machineName: t.machineName,
        machineLocation: t.machineLocation,
        tickets: [t],
      });
    }
  }
  return Array.from(byMachine.values()).sort((a, b) => {
    const aTime = a.tickets[0]?.reportedAt?.toDate?.().getTime() ?? 0;
    const bTime = b.tickets[0]?.reportedAt?.toDate?.().getTime() ?? 0;
    return bTime - aTime;
  });
}
