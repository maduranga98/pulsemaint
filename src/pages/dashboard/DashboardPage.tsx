import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Gauge,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuthStore } from '../../store/authStore';
import { useMachines } from '../../hooks/useMachines';
import { useInventoryStats } from '../../hooks/inventory/useInventoryStats';
import { usePMComplianceStats } from '../../hooks/pm/usePMComplianceStats';
import { usePMSchedules } from '../../hooks/pm/usePMSchedules';
import { BRAND_COLORS } from '../../constants/brand';
import type { Machine } from '../../types/machine';

interface KpiCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  iconColor: string;
  iconBg: string;
  trend?: string;
  trendColor?: string;
}

function KpiCard({ icon, value, label, iconColor, iconBg, trend, trendColor }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 shadow-sm">
      <div className={`p-2.5 rounded-lg ${iconBg} ${iconColor} shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-slate-900 leading-tight truncate">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        {trend && (
          <p className={`text-[11px] mt-1 font-medium ${trendColor ?? 'text-slate-500'}`}>{trend}</p>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse space-y-3">
      <div className="h-4 bg-slate-200 rounded w-1/3" />
      <div className="h-8 bg-slate-200 rounded w-1/2" />
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function healthBucket(score: number) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}

export default function DashboardPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const companyId = company?.id ?? userProfile?.companyId ?? '';
  const siteId = userProfile?.siteIds?.[0] ?? companyId;

  const { machines, loading: machinesLoading } = useMachines({ siteId, pageSize: 100 });
  const { stats: inventoryStats, loading: inventoryLoading } = useInventoryStats();
  const { stats: pmStats, loading: pmStatsLoading } = usePMComplianceStats({ companyId });
  const { schedules: pmSchedules, loading: pmSchedulesLoading } = usePMSchedules({
    companyId,
  });

  const machineBreakdown = useMemo(() => {
    const counts = { active: 0, under_maintenance: 0, decommissioned: 0 };
    machines.forEach((m: Machine) => {
      if (m.status in counts) counts[m.status as keyof typeof counts]++;
    });
    return counts;
  }, [machines]);

  const healthDistribution = useMemo(() => {
    const buckets = { good: 0, fair: 0, poor: 0, critical: 0 };
    machines.forEach((m: Machine) => {
      buckets[healthBucket(m.healthScore ?? 0)]++;
    });
    return [
      { name: 'Good (80+)', value: buckets.good, color: BRAND_COLORS.uptimeGreen },
      { name: 'Fair (60-79)', value: buckets.fair, color: '#84CC16' },
      { name: 'Poor (40-59)', value: buckets.poor, color: BRAND_COLORS.warningAmber },
      { name: 'Critical (<40)', value: buckets.critical, color: BRAND_COLORS.criticalRed },
    ];
  }, [machines]);

  const criticalMachines = useMemo(
    () =>
      machines
        .filter((m: Machine) => (m.healthScore ?? 100) < 60 || m.criticality >= 4)
        .sort((a, b) => (a.healthScore ?? 0) - (b.healthScore ?? 0))
        .slice(0, 5),
    [machines],
  );

  const upcomingPM = useMemo(() => {
    const now = Date.now();
    return pmSchedules
      .filter((s) => s.status === 'active' && s.nextDueDate)
      .map((s) => {
        const due = s.nextDueDate?.toDate ? s.nextDueDate.toDate() : new Date(s.nextDueDate as any);
        return { ...s, dueDate: due, daysUntil: Math.ceil((due.getTime() - now) / 86_400_000) };
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5);
  }, [pmSchedules]);

  const overduePMCount = useMemo(
    () => pmSchedules.filter((s) => s.operationalStatus === 'overdue').length,
    [pmSchedules],
  );

  const monthlyTrend = pmStats?.monthlyTrend ?? [];

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'there';
  const isLoading = machinesLoading || inventoryLoading || pmSchedulesLoading;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{todayStr}</p>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <SkeletonCard key={k} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Cpu className="w-6 h-6" />}
            value={machines.length}
            label="Total Machines"
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            trend={`${machineBreakdown.active} active`}
            trendColor="text-emerald-600"
          />
          <KpiCard
            icon={<Wrench className="w-6 h-6" />}
            value={machineBreakdown.under_maintenance}
            label="Under Maintenance"
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
          <KpiCard
            icon={<AlertTriangle className="w-6 h-6" />}
            value={overduePMCount}
            label="Overdue PM Tasks"
            iconColor="text-red-600"
            iconBg="bg-red-50"
            trend={overduePMCount > 0 ? 'Needs attention' : 'On track'}
            trendColor={overduePMCount > 0 ? 'text-red-600' : 'text-emerald-600'}
          />
          <KpiCard
            icon={<Gauge className="w-6 h-6" />}
            value={`${Math.round(pmStats?.overallComplianceRate ?? 0)}%`}
            label="PM Compliance"
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            trend={pmStatsLoading ? 'Loading…' : 'This month'}
          />
        </div>
      )}

      {/* Inventory KPIs */}
      {!inventoryLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Box className="w-6 h-6" />}
            value={inventoryStats.totalParts.toLocaleString()}
            label="Parts in Catalog"
            iconColor="text-slate-700"
            iconBg="bg-slate-100"
          />
          <KpiCard
            icon={<AlertTriangle className="w-6 h-6" />}
            value={inventoryStats.lowStockCount}
            label="Low Stock"
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            trend={
              inventoryStats.outOfStockCount > 0
                ? `${inventoryStats.outOfStockCount} out of stock`
                : 'All in stock'
            }
            trendColor={inventoryStats.outOfStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}
          />
          <KpiCard
            icon={<ClipboardList className="w-6 h-6" />}
            value={inventoryStats.activeRequests}
            label="Active Parts Requests"
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
          />
          <KpiCard
            icon={<Activity className="w-6 h-6" />}
            value={inventoryStats.pendingPOs}
            label="Pending POs"
            iconColor="text-cyan-600"
            iconBg="bg-cyan-50"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Machine Health Distribution"
          action={
            <Link to="/app/machines" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all
            </Link>
          }
        >
          {machines.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              No machines registered yet.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {healthDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="PM Compliance — Last 6 Months"
          action={
            <Link
              to="/app/pm-compliance"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              View report
            </Link>
          }
        >
          {monthlyTrend.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              {pmStatsLoading ? 'Loading compliance data…' : 'No PM history yet.'}
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => `${Math.round(v)}%`} />
                  <Bar dataKey="complianceRate" fill={BRAND_COLORS.powerBlue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Lists row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Machines Needing Attention"
          action={
            <Link to="/app/machines" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              All machines
            </Link>
          }
        >
          {criticalMachines.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">All machines are healthy.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-5">
              {criticalMachines.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/app/machines/${m.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{m.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {m.manufacturer} · {m.model}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p
                        className={`text-sm font-semibold ${
                          (m.healthScore ?? 100) < 40
                            ? 'text-red-600'
                            : (m.healthScore ?? 100) < 60
                              ? 'text-amber-600'
                              : 'text-slate-700'
                        }`}
                      >
                        {Math.round(m.healthScore ?? 0)}%
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase">Health</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming PM Tasks"
          action={
            <Link
              to="/app/pm-schedules"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              View schedules
            </Link>
          }
        >
          {upcomingPM.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No upcoming PM tasks.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-5">
              {upcomingPM.map((s) => {
                const isOverdue = s.daysUntil < 0;
                const isDueSoon = s.daysUntil >= 0 && s.daysUntil <= 7;
                return (
                  <li key={s.id}>
                    <Link
                      to={`/app/pm-schedules/${s.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{s.machineName}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p
                          className={`text-sm font-semibold ${
                            isOverdue
                              ? 'text-red-600'
                              : isDueSoon
                                ? 'text-amber-600'
                                : 'text-slate-700'
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(s.daysUntil)}d late`
                            : s.daysUntil === 0
                              ? 'Today'
                              : `${s.daysUntil}d`}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase">
                          {s.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Quick Links */}
      <SectionCard title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/app/machines/new"
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            <Cpu className="w-4 h-4 text-blue-600" />
            Add Machine
          </Link>
          <Link
            to="/app/pm-schedules/create"
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            New PM Schedule
          </Link>
          <Link
            to="/app/inventory"
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            <Box className="w-4 h-4 text-amber-600" />
            Inventory
          </Link>
          <Link
            to="/app/triage-builder"
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            <Activity className="w-4 h-4 text-emerald-600" />
            Triage Builder
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
