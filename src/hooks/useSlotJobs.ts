import { useEffect, useState } from 'react';
import type { SlotJob } from '../lib/assignmentSlots';
import { fetchSlotJobs } from '../services/technicianAvailability.service';

/** Open work orders / breakdowns as time slots (read once when `siteId` is set, e.g. when a picker opens). */
export function useSlotJobs(siteId: string | undefined): SlotJob[] {
  const [jobs, setJobs] = useState<SlotJob[]>([]);
  useEffect(() => {
    if (!siteId) {
      setJobs([]);
      return;
    }
    let cancelled = false;
    fetchSlotJobs(siteId).then((j) => !cancelled && setJobs(j)).catch(() => !cancelled && setJobs([]));
    return () => {
      cancelled = true;
    };
  }, [siteId]);
  return jobs;
}
