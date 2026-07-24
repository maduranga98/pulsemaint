import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMHistory, ComplianceStats, MonthlyComplianceTrend, MachineComplianceRecord, TechnicianComplianceRecord } from '../../types/pm.types';
import { calculateComplianceRate, getEffectivePMHistoryStatus } from '../../utils/pm.utils';

const HISTORY_COLLECTION = 'pm_history';

interface UsePMComplianceStatsOptions {
  companyId: string;
}

// Month key ("2026-07") from a Firestore Timestamp / Date / ISO value.
function monthKeyOf(value: unknown): string | null {
  if (!value) return null;
  let d: Date | null = null;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as Record<string, unknown>)) {
    d = new Date(Number((value as { seconds: number }).seconds) * 1000);
  } else if (value instanceof Date) {
    d = value;
  } else {
    const parsed = new Date(String(value));
    d = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

    setLoading(true);
    let history: PMHistory[] = [];
    let breakdownMonthCounts: Record<string, number> = {};
    const ready = { pm: false, breakdowns: false };

    function recompute() {
      if (!ready.pm || !ready.breakdowns) return;
      try {
        // Current month stats
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Overdue PMs are never stamped as 'overdue' in Firestore — derive the
        // effective status (an uncompleted PM past its due date is overdue) so
        // the dashboard reflects them live as due dates pass.
        // Idempotent: getEffectivePMHistoryStatus passes completed/missed/overdue
        // through unchanged, so re-decorating on a breakdown-only recompute is safe.
        history = history.map((h) => ({
          ...h,
          status: getEffectivePMHistoryStatus(h, now) as typeof h.status,
        }));

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

          monthlyTrend.push({
            month: monthKey,
            complianceRate: rate,
            breakdownCount: breakdownMonthCounts[monthKey] ?? 0,
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
        console.error('Error computing compliance stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to compute compliance stats');
      } finally {
        setLoading(false);
      }
    }

    // Live PM history — recomputes compliance on any change.
    const unsubPm = onSnapshot(
      query(collection(db, HISTORY_COLLECTION), where('companyId', '==', companyId)),
      (snap) => {
        history = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PMHistory[];
        ready.pm = true;
        recompute();
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    // Live breakdowns — feeds the per-month breakdown bar on the trend chart.
    const unsubBreakdowns = onSnapshot(
      query(collection(db, 'breakdown_tickets'), where('companyId', '==', companyId)),
      (snap) => {
        const counts: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const b = d.data() as any;
          const key = monthKeyOf(b.reportedAt ?? b.createdAt);
          if (key) counts[key] = (counts[key] ?? 0) + 1;
        });
        breakdownMonthCounts = counts;
        ready.breakdowns = true;
        recompute();
      },
      () => {
        // Breakdowns are supplementary; don't block compliance stats on them.
        ready.breakdowns = true;
        recompute();
      },
    );

    return () => {
      unsubPm();
      unsubBreakdowns();
    };
  }, [companyId]);

  return { stats, loading, error };
}
