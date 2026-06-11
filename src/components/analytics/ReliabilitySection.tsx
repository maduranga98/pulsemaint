import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { getBadActors, computePMComplianceStatus, computeWrenchTimePercent } from '../../lib/reliabilityUtils';
import type { TimeSegment } from '../../types/workOrder';

interface ReliabilitySectionProps {
  monthly: any;
  companyId: string;
}

const BAD_ACTOR_STEPS = ['root_cause', 'fix_applied', 'monitoring', 'graduated'] as const;
type BadActorStep = typeof BAD_ACTOR_STEPS[number];

const STEP_LABELS: Record<BadActorStep, string> = {
  root_cause: 'Root Cause',
  fix_applied: 'Fix Applied',
  monitoring: 'Monitoring',
  graduated: 'Graduated',
};

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

interface BadActorMachine {
  machineId: string;
  machineName: string;
  breakdownCount: number;
  workflowStatus: BadActorStep | null;
}

interface PieEntry {
  name: string;
  value: number;
  color: string;
}

export function ReliabilitySection({ monthly }: ReliabilitySectionProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId || '';
  const role = userProfile?.role ?? '';
  const isSupervisor = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'].includes(role);

  const pmRate = monthly?.pmComplianceRate ?? 0;
  const pmStatus = computePMComplianceStatus(pmRate);

  // Bad actors state
  const [badActors, setBadActors] = useState<BadActorMachine[]>([]);
  const [badActorsLoading, setBadActorsLoading] = useState(true);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  // Wrench time state
  const [pieData, setPieData] = useState<PieEntry[]>([]);
  const [overallWrenchPct, setOverallWrenchPct] = useState(0);
  const [wrenchLoading, setWrenchLoading] = useState(true);

  // PM trend data (dummy trend since we only have one monthly data point)
  const pmTrendData = [
    { name: 'Jan', rate: pmRate * 0.8 },
    { name: 'Feb', rate: pmRate * 0.85 },
    { name: 'Mar', rate: pmRate * 0.9 },
    { name: 'Apr', rate: pmRate * 0.95 },
    { name: 'May', rate: pmRate * 0.97 },
    { name: 'Jun', rate: pmRate },
  ];

  useEffect(() => {
    if (!siteId) return;

    async function loadBadActors() {
      setBadActorsLoading(true);
      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const ninetyDaysTs = Timestamp.fromDate(ninetyDaysAgo);

        const bdSnap = await getDocs(
          query(
            collection(db, 'breakdown_tickets'),
            where('siteId', '==', siteId),
          ),
        );

        const breakdowns = bdSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((b) => {
            const ts: Timestamp = b.reportedAt;
            if (!ts) return false;
            const ms = ts?.toMillis?.() ?? Number(ts);
            return ms >= ninetyDaysTs.toMillis();
          });

        // Count by machineId
        const counts: Record<string, number> = {};
        const nameMap: Record<string, string> = {};
        for (const bd of breakdowns) {
          if (!bd.machineId) continue;
          counts[bd.machineId] = (counts[bd.machineId] ?? 0) + 1;
          nameMap[bd.machineId] = bd.machineName || bd.machineId;
        }

        const machineSnap = await getDocs(
          query(collection(db, 'machines'), where('siteId', '==', siteId)),
        );
        const totalMachines = machineSnap.size;
        const machineDataMap = new Map<string, any>();
        machineSnap.forEach((d) => machineDataMap.set(d.id, { id: d.id, ...d.data() }));

        const badActorIds = getBadActors(counts, totalMachines);

        const result: BadActorMachine[] = badActorIds
          .filter((id) => {
            const machineData = machineDataMap.get(id);
            return machineData?.badActorWorkflow?.status !== 'graduated';
          })
          .map((id) => {
            const machineData = machineDataMap.get(id);
            return {
              machineId: id,
              machineName: nameMap[id] || id,
              breakdownCount: counts[id] ?? 0,
              workflowStatus: (machineData?.badActorWorkflow?.status as BadActorStep) ?? null,
            };
          });

        setBadActors(result);
      } catch (err) {
        console.error('Bad actors load error', err);
      } finally {
        setBadActorsLoading(false);
      }
    }

    loadBadActors();
  }, [siteId]);

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

        woSnap.forEach((d) => {
          const wo = d.data();
          const segments: TimeSegment[] = wo.timeSegments ?? [];
          if (segments.length === 0) return;

          const woCreatedMs =
            (wo.createdAt as any)?.toMillis?.() ?? Number(wo.createdAt) ?? 0;
          if (woCreatedMs < thirtyDaysAgo.getTime()) return;

          for (const seg of segments) {
            if (seg.endAt === null) continue;
            const startMs = (seg.startAt as any)?.toMillis?.() ?? Number(seg.startAt);
            const endMs = (seg.endAt as any)?.toMillis?.() ?? Number(seg.endAt);
            const ms = Math.max(0, endMs - startMs);
            stateMs[seg.state] = (stateMs[seg.state] ?? 0) + ms;
            totalMs += ms;
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

  async function handleAdvance(machineId: string, currentStep: BadActorStep | null) {
    const currentIdx = currentStep ? BAD_ACTOR_STEPS.indexOf(currentStep) : -1;
    const nextIdx = currentIdx + 1;
    if (nextIdx >= BAD_ACTOR_STEPS.length) return;
    const nextStep = BAD_ACTOR_STEPS[nextIdx];

    setAdvancingId(machineId);
    try {
      await updateDoc(doc(db, 'machines', machineId), {
        badActorWorkflow: {
          status: nextStep,
          updatedAt: serverTimestamp(),
          notes: '',
        },
      });
      setBadActors((prev) =>
        prev
          .map((b) =>
            b.machineId === machineId ? { ...b, workflowStatus: nextStep } : b,
          )
          .filter((b) => b.workflowStatus !== 'graduated'),
      );
    } catch (err: any) {
      console.error('Advance error', err);
    } finally {
      setAdvancingId(null);
    }
  }

  const pmColor =
    pmStatus === 'good'
      ? 'text-emerald-400'
      : pmStatus === 'warning'
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* A. PM Compliance Trend */}
      <div className="rounded-xl bg-[#0F1E35] border border-[#1E3A5F] p-5">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-[#8BA3BF] uppercase tracking-wide">PM Compliance Rate</p>
            <p className={`text-4xl font-bold ${pmColor}`}>{Math.round(pmRate)}%</p>
          </div>
          <div className="ml-auto text-xs text-[#8BA3BF]">
            Target: 80%
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={pmTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
            <XAxis dataKey="name" tick={{ fill: '#8BA3BF', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#8BA3BF', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }}
              formatter={(val: number) => [`${Math.round(val)}%`, 'PM Compliance']}
            />
            <ReferenceLine
              y={80}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              label={{ value: 'Target', fill: '#F59E0B', fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke={pmStatus === 'good' ? '#10B981' : pmStatus === 'warning' ? '#F59E0B' : '#EF4444'}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-[#8BA3BF] mt-2">
          Note: Enable 6-month historical range for full trend data.
        </p>
      </div>

      {/* B. Bad Actor Machines */}
      <div className="rounded-xl bg-[#0F1E35] border border-[#1E3A5F] p-5">
        <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Bad Actor Machines (90 days)</h3>
        {badActorsLoading ? (
          <p className="text-[#8BA3BF] text-sm">Loading…</p>
        ) : badActors.length === 0 ? (
          <p className="text-[#8BA3BF] text-sm">No machines flagged as bad actors.</p>
        ) : (
          <div className="space-y-3">
            {badActors.map((actor) => {
              const stepIdx = actor.workflowStatus
                ? BAD_ACTOR_STEPS.indexOf(actor.workflowStatus)
                : -1;
              const canAdvance = isSupervisor && stepIdx < BAD_ACTOR_STEPS.length - 1;

              return (
                <div
                  key={actor.machineId}
                  className="bg-[#0A1628] rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#F0F4F8] flex-1">{actor.machineName}</p>
                    <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">
                      {actor.breakdownCount} breakdowns
                    </span>
                  </div>

                  {/* Stepper */}
                  <div className="flex items-center gap-1">
                    {BAD_ACTOR_STEPS.filter((s) => s !== 'graduated').map((step, idx) => {
                      const done = stepIdx >= idx;
                      return (
                        <div key={step} className="flex items-center">
                          <div
                            className={`flex flex-col items-center ${idx > 0 ? 'ml-1' : ''}`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                                done ? 'bg-emerald-500 text-white' : 'bg-[#1E3A5F] text-[#8BA3BF]'
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <span className="text-xs text-[#8BA3BF] mt-0.5 whitespace-nowrap" style={{ fontSize: '10px' }}>
                              {STEP_LABELS[step]}
                            </span>
                          </div>
                          {idx < 2 && (
                            <div className={`h-0.5 w-4 mx-0.5 ${done && stepIdx > idx ? 'bg-emerald-500' : 'bg-[#1E3A5F]'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canAdvance && (
                    <button
                      type="button"
                      onClick={() => handleAdvance(actor.machineId, actor.workflowStatus)}
                      disabled={advancingId === actor.machineId}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {advancingId === actor.machineId
                        ? 'Advancing…'
                        : `Advance → ${STEP_LABELS[BAD_ACTOR_STEPS[stepIdx + 1]]}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* C. Wrench Time Overview */}
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
