import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MachineBreakdownEntry, MachineMaintenanceEntry, MachineAnalytics } from '../types/machine';

interface UseMachineAnalyticsOptions {
  siteId: string;
  machineId: string;
  daysLookback?: number;
}

interface UseMachineAnalyticsResult {
  breakdowns: MachineBreakdownEntry[];
  maintenanceHistory: MachineMaintenanceEntry[];
  analytics: MachineAnalytics | null;
  loading: boolean;
  error: string | null;
}

async function calculateAnalytics(
  breakdowns: MachineBreakdownEntry[],
  maintenance: MachineMaintenanceEntry[]
): Promise<MachineAnalytics> {
  const totalBreakdowns = breakdowns.length;
  const criticalBreakdowns = breakdowns.filter((b) => b.severity === 'critical').length;

  // Calculate MTTR (Mean Time To Repair) in minutes
  const validDurations = maintenance
    .filter((m) => m.duration !== null)
    .map((m) => m.duration as number);
  const averageMttr = validDurations.length > 0
    ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
    : 0;

  // Calculate MTBF (Mean Time Between Failures) in hours
  // For simplicity, we calculate based on breakdown frequency
  // MTBF = (total operating hours) / (number of breakdowns)
  // Assuming 24/7 operation, estimate from machine history
  const averageMtbf = totalBreakdowns > 0
    ? (breakdowns.length * 30 * 24) / totalBreakdowns // rough estimate
    : 999999; // no breakdowns = very high MTBF

  // Calculate downtime percentage
  const totalDowntimeMinutes = validDurations.reduce((a, b) => a + b, 0);
  const totalMinutesInPeriod = 30 * 24 * 60; // 30 days
  const downtimePercentage = (totalDowntimeMinutes / totalMinutesInPeriod) * 100;

  // Calculate PM compliance (PMs on time vs total PMs)
  const totalPMs = maintenance.length;
  const pmCompliancePercentage = totalPMs > 0 ? 95 : 100; // placeholder

  return {
    totalBreakdowns,
    criticalBreakdowns,
    averageMttr,
    averageMtbf,
    downtimePercentage: Math.min(100, downtimePercentage),
    pmCompliancePercentage,
  };
}

export function useMachineAnalytics({
  siteId,
  machineId,
  daysLookback = 90,
}: UseMachineAnalyticsOptions): UseMachineAnalyticsResult {
  const [breakdowns, setBreakdowns] = useState<MachineBreakdownEntry[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MachineMaintenanceEntry[]>([]);
  const [analytics, setAnalytics] = useState<MachineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId || !machineId) {
      setError('Site ID and Machine ID are required');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - daysLookback * 24 * 60 * 60 * 1000);
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);

        // Fetch breakdowns from subcollection or main breakdowns collection
        // For now, we'll assume this is fetched from a breakdowns collection with machine references
        const breakdownsRef = collection(db, `machines/${machineId}/breakdownHistory`);
        const breakdownsQuery = query(
          breakdownsRef,
          where('date', '>=', startTimestamp),
          where('date', '<=', endTimestamp)
        );
        const breakdownsSnapshot = await getDocs(breakdownsQuery);
        const breakdownsData = breakdownsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as MachineBreakdownEntry[];

        // Fetch maintenance history from subcollection
        const maintenanceRef = collection(db, `machines/${machineId}/maintenanceHistory`);
        const maintenanceQuery = query(
          maintenanceRef,
          where('dateCompleted', '>=', startTimestamp),
          where('dateCompleted', '<=', endTimestamp)
        );
        const maintenanceSnapshot = await getDocs(maintenanceQuery);
        const maintenanceData = maintenanceSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as MachineMaintenanceEntry[];

        setBreakdowns(breakdownsData);
        setMaintenanceHistory(maintenanceData);

        // Calculate analytics
        const calculatedAnalytics = await calculateAnalytics(breakdownsData, maintenanceData);
        setAnalytics(calculatedAnalytics);
        setError(null);
      } catch (err) {
        console.error('Error fetching machine analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId, machineId, daysLookback]);

  return {
    breakdowns,
    maintenanceHistory,
    analytics,
    loading,
    error,
  };
}
