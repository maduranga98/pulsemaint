import { useState, useEffect } from 'react';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { TimeSegment } from '../../types/workOrder';

interface ReliabilitySectionProps {
  companyId: string;
}

const PIE_COLORS: Record<string, string> = {
  travel: '#3B82F6',
  'waiting-parts': '#F59E0B',
  'waiting-permit': '#F97316',
  working: '#10B981',
};

const PIE_STATE_LABELS: Record<string, string> = {
  travel: 'Travel',
  'waiting-parts': 'Waiting – Parts',
  'waiting-permit': 'Waiting – Permit',
  working: 'Working',
};

interface PieEntry {
  name: string;
  value: number;
  color: string;
}

export function ReliabilitySection({}: ReliabilitySectionProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId || '';

  // Wrench time state — sourced entirely from Work Order records
  // (timeSegments, or actualStartTime/actualEndTime/totalDurationMinutes as
  // a fallback for WOs completed before time-segment tracking existed).
  const [pieData, setPieData] = useState<PieEntry[]>([]);
  const [overallWrenchPct, setOverallWrenchPct] = useState(0);
  const [wrenchLoading, setWrenchLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;

    async function loadWrenchTime() {
      setWrenchLoading(true);
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const woSnap = await getDocs(
          query(
            collection(db, 'workOrders'),
            where('siteId', '==', siteId),
          ),
        );

        const stateMs: Record<string, number> = {
          travel: 0,
          'waiting-parts': 0,
          'waiting-permit': 0,
          working: 0,
        };
        let totalMs = 0;

        let hasAnySegments = false;

        const toMs = (v: any): number =>
          v?.toMillis?.() ?? (typeof v === 'number' ? v : v ? new Date(v).getTime() : 0);

        woSnap.forEach((d) => {
          const wo = d.data();

          // Gate on when the work actually happened (completion / last update),
          // falling back to creation — so recently-worked WOs count even if they
          // were raised more than 30 days ago.
          const activityMs =
            toMs(wo.actualEndTime) || toMs(wo.updatedAt) || toMs(wo.createdAt);
          if (activityMs && activityMs < thirtyDaysAgo.getTime()) return;

          const segments: TimeSegment[] = wo.timeSegments ?? [];
          if (segments.length > 0) {
            for (const seg of segments) {
              if (seg.endAt === null) continue;
              const startMs = toMs(seg.startAt);
              const endMs = toMs(seg.endAt);
              const ms = Math.max(0, endMs - startMs);
              stateMs[seg.state] = (stateMs[seg.state] ?? 0) + ms;
              totalMs += ms;
              hasAnySegments = true;
            }
            return;
          }

          // Fallback: WOs completed before time-segment tracking existed (or via
          // the technician execution sheet) still carry real hands-on duration in
          // the WO detail. Count that as working ("wrench") time so the overview
          // reflects actual completed-work data instead of sitting empty.
          let workingMs = 0;
          if (typeof wo.totalDurationMinutes === 'number' && wo.totalDurationMinutes > 0) {
            workingMs = wo.totalDurationMinutes * 60000;
          } else {
            const startMs = toMs(wo.actualStartTime);
            const endMs = toMs(wo.actualEndTime);
            if (startMs && endMs && endMs > startMs) workingMs = endMs - startMs;
          }
          if (workingMs > 0) {
            stateMs.working += workingMs;
            totalMs += workingMs;
            hasAnySegments = true;
          }
        });

        if (!hasAnySegments) {
          setPieData([]);
          setOverallWrenchPct(0);
        } else {
          const entries: PieEntry[] = Object.entries(stateMs)
            .filter(([, v]) => v > 0)
            .map(([state, ms]) => ({
              name: PIE_STATE_LABELS[state] ?? state,
              value: Math.round(ms / 60000), // Convert to minutes
              color: PIE_COLORS[state] ?? '#94a3b8',
            }));
          setPieData(entries);
          const workingMs = stateMs['working'] ?? 0;
          setOverallWrenchPct(
            totalMs > 0 ? Math.round((workingMs / totalMs) * 100) : 0,
          );
        }
      } catch (err) {
        console.error('Wrench time load error', err);
      } finally {
        setWrenchLoading(false);
      }
    }

    loadWrenchTime();
  }, [siteId]);

  return (
    <div className="space-y-6">
      {/* Wrench Time Overview */}
      <div className="rounded-xl bg-[#0F1E35] border border-[#1E3A5F] p-5">
        <h3 className="text-sm font-semibold text-[#F0F4F8] mb-1">Wrench Time Overview (30 days)</h3>
        {wrenchLoading ? (
          <p className="text-[#8BA3BF] text-sm">Loading…</p>
        ) : pieData.length === 0 ? (
          <p className="text-[#8BA3BF] text-sm">No time segments logged in the last 30 days.</p>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-center">
              <p className="text-4xl font-bold text-emerald-400">{overallWrenchPct}%</p>
              <p className="text-xs text-[#8BA3BF] mt-1">Wrench Time</p>
            </div>
            <div className="flex-1 min-w-[200px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }}
                    formatter={(val: number) => [`${val} min`, '']}
                  />
                  <Legend
                    wrapperStyle={{ color: '#8BA3BF', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
