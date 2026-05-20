import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMHistory, ComplianceStats, MonthlyComplianceTrend, MachineComplianceRecord, TechnicianComplianceRecord } from '../../types/pm.types';
import { calculateComplianceRate } from '../../utils/pm.utils';

const HISTORY_COLLECTION = 'pm_history';

interface UsePMComplianceStatsOptions {
  companyId: string;
}

export function usePMComplianceStats({ companyId }: UsePMComplianceStatsOptions) {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setError('Company ID is required');
      setLoading(false);
      return;
    }

    async function fetchStats() {
      setLoading(true);
      try {
        // Fetch PM history for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const historyQuery = query(
          collection(db, HISTORY_COLLECTION),
          where('companyId', '==', companyId),
        );

        const historySnap = await getDocs(historyQuery);
        const history = historySnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PMHistory[];

        // Current month stats
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const currentMonthHistory = history.filter((h) => h.month === currentMonthKey);
        const totalScheduledThisMonth = currentMonthHistory.length;
        const completedOnTimeThisMonth = currentMonthHistory.filter(
          (h) => h.status === 'completed_on_time',
        ).length;
        const overdueCount = currentMonthHistory.filter(
          (h) => h.status === 'overdue' || h.status === 'missed',
        ).length;

        const overallComplianceRate = totalScheduledThisMonth > 0
          ? Math.round((completedOnTimeThisMonth / totalScheduledThisMonth) * 100)
          : 100;

        // Monthly trend (last 6 months)
        const monthlyTrend: MonthlyComplianceTrend[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const monthHistory = history.filter((h) => h.month === monthKey);
          const scheduled = monthHistory.length;
          const completed = monthHistory.filter((h) => h.status === 'completed_on_time').length;
          const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 100;

          // Placeholder for breakdown count — in production this would query breakdowns collection
          monthlyTrend.push({
            month: monthKey,
            complianceRate: rate,
            breakdownCount: 0,
            scheduledCount: scheduled,
            completedCount: completed,
          });
        }

        // By machine
        const machineMap = new Map<string, MachineComplianceRecord>();
        history.forEach((h) => {
          const existing = machineMap.get(h.machineId);
          if (existing) {
            existing.totalScheduled++;
            if (h.status === 'completed_on_time') existing.completedOnTime++;
            else if (h.status === 'completed_late') existing.completedLate++;
            else if (h.status === 'missed' || h.status === 'overdue') existing.missed++;
            existing.complianceRate = calculateComplianceRate(
              existing.completedOnTime,
              existing.completedLate,
              existing.missed,
            );
          } else {
            machineMap.set(h.machineId, {
              machineId: h.machineId,
              machineName: h.machineName,
              totalScheduled: 1,
              completedOnTime: h.status === 'completed_on_time' ? 1 : 0,
              completedLate: h.status === 'completed_late' ? 1 : 0,
              missed: h.status === 'missed' || h.status === 'overdue' ? 1 : 0,
              complianceRate: 0,
            });
          }
        });
        const byMachine = Array.from(machineMap.values()).sort(
          (a, b) => a.complianceRate - b.complianceRate,
        );

        // By technician
        const techMap = new Map<string, TechnicianComplianceRecord>();
        history.forEach((h) => {
          h.technicianIds.forEach((techId, idx) => {
            const existing = techMap.get(techId);
            if (existing) {
              existing.totalAssigned++;
              if (h.status === 'completed_on_time') existing.completedOnTime++;
              else if (h.status === 'completed_late') existing.completedLate++;
              else if (h.status === 'missed' || h.status === 'overdue') existing.missed++;
              existing.complianceRate = calculateComplianceRate(
                existing.completedOnTime,
                existing.completedLate,
                existing.missed,
              );
            } else {
              techMap.set(techId, {
                technicianId: techId,
                technicianName: h.technicianNames[idx] || 'Unknown',
                totalAssigned: 1,
                completedOnTime: h.status === 'completed_on_time' ? 1 : 0,
                completedLate: h.status === 'completed_late' ? 1 : 0,
                missed: h.status === 'missed' || h.status === 'overdue' ? 1 : 0,
                complianceRate: 0,
              });
            }
          });
        });
        const byTechnician = Array.from(techMap.values()).sort(
          (a, b) => a.complianceRate - b.complianceRate,
        );

        setStats({
          overallComplianceRate,
          totalScheduledThisMonth,
          completedOnTimeThisMonth,
          overdueCount,
          monthlyTrend,
          byMachine,
          byTechnician,
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching compliance stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch compliance stats');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [companyId]);

  return { stats, loading, error };
}
