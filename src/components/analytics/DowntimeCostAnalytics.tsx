import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { computeDowntimeCost } from '../../lib/downtimeCost';

interface MachineRow {
  machineId: string;
  machineName: string;
  totalHours: number;
  rate: number;
  totalCost: number;
  currency: string;
}

interface DeptRow {
  department: string;
  totalCost: number;
  currency: string;
}

interface MonthRow {
  month: string;
  totalCost: number;
}

export function DowntimeCostAnalytics() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId || '';

  const [machineRows, setMachineRows] = useState<MachineRow[]>([]);
  const [deptRows, setDeptRows] = useState<DeptRow[]>([]);
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCost, setHasCost] = useState(false);

  useEffect(() => {
    if (!siteId) return;

    async function load() {
      setLoading(true);
      try {
        // Fetch machines
        const machinesSnap = await getDocs(
          query(collection(db, 'machines'), where('siteId', '==', siteId)),
        );
        const machineMap = new Map<string, any>();
        machinesSnap.forEach((d) => {
          const data = d.data();
          machineMap.set(d.id, { id: d.id, ...data });
        });

        const anyWithCost = Array.from(machineMap.values()).some(
          (m) =>
            m.costPerHourDown != null ||
            (m.unitsPerHour != null && m.unitValue != null),
        );
        setHasCost(anyWithCost);

        if (!anyWithCost) {
          setLoading(false);
          return;
        }

        // Fetch breakdowns last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const bdSnap = await getDocs(
          query(
            collection(db, 'breakdown_tickets'),
            where('siteId', '==', siteId),
            where('status', 'in', ['resolved', 'closed']),
          ),
        );

        const breakdowns = bdSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((b) => {
            const ts: Timestamp = b.reportedAt;
            if (!ts) return false;
            const ms = ts?.toMillis?.() ?? Number(ts);
            return ms >= sixMonthsAgo.getTime();
          })
          .filter((b) => (b.productionHoursLost ?? 0) > 0);

        // Aggregate per machine
        const machineAgg = new Map<string, { name: string; hours: number; dept: string; rate: number; currency: string }>();

        for (const bd of breakdowns) {
          const machine = machineMap.get(bd.machineId);
          if (!machine) continue;

          const rate = (() => {
            if (machine.costPerHourDown != null) return machine.costPerHourDown;
            if (machine.unitsPerHour != null && machine.unitValue != null)
              return machine.unitsPerHour * machine.unitValue;
            return null;
          })();
          if (rate === null) continue;

          const existing = machineAgg.get(bd.machineId);
          if (existing) {
            existing.hours += bd.productionHoursLost;
          } else {
            machineAgg.set(bd.machineId, {
              name: bd.machineName || machine.name,
              hours: bd.productionHoursLost,
              dept: bd.machineDepartment || machine.department || '—',
              rate,
              currency: machine.costCurrency ?? 'LKR',
            });
          }
        }

        const mRows: MachineRow[] = Array.from(machineAgg.entries()).map(([id, v]) => ({
          machineId: id,
          machineName: v.name,
          totalHours: v.hours,
          rate: v.rate,
          totalCost: v.hours * v.rate,
          currency: v.currency,
        }));
        mRows.sort((a, b) => b.totalCost - a.totalCost);
        setMachineRows(mRows);

        // Dept aggregation
        const deptAgg = new Map<string, { cost: number; currency: string }>();
        for (const row of mRows) {
          const machine = machineMap.get(row.machineId);
          const dept = machine?.department || '—';
          const existing = deptAgg.get(dept);
          if (existing) existing.cost += row.totalCost;
          else deptAgg.set(dept, { cost: row.totalCost, currency: row.currency });
        }
        const dRows: DeptRow[] = Array.from(deptAgg.entries()).map(([dept, v]) => ({
          department: dept,
          totalCost: v.cost,
          currency: v.currency,
        }));
        dRows.sort((a, b) => b.totalCost - a.totalCost);
        setDeptRows(dRows);

        // Monthly aggregation (last 6 months)
        const monthlyMap = new Map<string, number>();
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthlyMap.set(key, 0);
        }

        for (const bd of breakdowns) {
          const machine = machineMap.get(bd.machineId);
          if (!machine) continue;
          const rate = (() => {
            if (machine.costPerHourDown != null) return machine.costPerHourDown;
            if (machine.unitsPerHour != null && machine.unitValue != null)
              return machine.unitsPerHour * machine.unitValue;
            return null;
          })();
          if (rate === null) continue;

          const ts: Timestamp = bd.reportedAt;
          const ms = ts?.toMillis?.() ?? Number(ts);
          const d = new Date(ms);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyMap.has(key)) {
            monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + bd.productionHoursLost * rate);
          }
        }

        setMonthRows(
          Array.from(monthlyMap.entries()).map(([month, totalCost]) => ({
            month: month.slice(5), // MM
            totalCost,
          })),
        );
      } catch (err) {
        console.error('DowntimeCostAnalytics error', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [siteId]);

  if (loading) {
    return (
      <div className="text-center py-8 text-[#8BA3BF] text-sm">
        Loading downtime cost data…
      </div>
    );
  }

  if (!hasCost) {
    return (
      <div className="rounded-xl bg-[#0F1E35] border border-[#1E3A5F] p-6 text-center text-[#8BA3BF] text-sm">
        Configure downtime cost rates in machine profiles to see lost-production cost analysis.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Per Machine Table */}
      <div className="rounded-xl bg-[#0F1E35] border border-[#1E3A5F] p-5">
        <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Per Machine</h3>
        {machineRows.length === 0 ? (
          <p className="text-[#8BA3BF] text-sm">No resolved/closed breakdowns with production hours lost.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[#8BA3BF] uppercase">
                <tr>
                  <th className="pb-2 text-left">Machine</th>
                  <th className="pb-2 text-right">Downtime Hours</th>
                  <th className="pb-2 text-right">Rate/hr</th>
                  <th className="pb-2 text-right">Total Lost Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]">
                {machineRows.map((row) => (
                  <tr key={row.machineId}>
                    <td className="py-2 text-[#F0F4F8]">{row.machineName}</td>
                    <td className="py-2 text-right text-[#8BA3BF]">{row.totalHours.toFixed(1)}h</td>
                    <td className="py-2 text-right text-[#8BA3BF]">
                      {row.currency} {row.rate.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-semibold text-red-400">
                      {row.currency} {Math.round(row.totalCost).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per Department Table */}
      {deptRows.length > 0 && (
        <div className="rounded-xl bg-[#0F1E35] border border-[#1E3A5F] p-5">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Per Department</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[#8BA3BF] uppercase">
                <tr>
                  <th className="pb-2 text-left">Department</th>
                  <th className="pb-2 text-right">Total Lost Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]">
                {deptRows.map((row) => (
                  <tr key={row.department}>
                    <td className="py-2 text-[#F0F4F8]">{row.department}</td>
                    <td className="py-2 text-right font-semibold text-red-400">
                      {row.currency} {Math.round(row.totalCost).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Bar Chart */}
      {monthRows.length > 0 && (
        <div className="rounded-xl bg-[#0F1E35] border border-[#1E3A5F] p-5">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4">Monthly Lost Cost (6 Months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthRows} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis dataKey="month" tick={{ fill: '#8BA3BF', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#8BA3BF', fontSize: 12 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              />
              <Tooltip
                contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }}
                formatter={(val: number) => [`${Math.round(val).toLocaleString()}`, 'Cost']}
              />
              <Bar dataKey="totalCost" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
