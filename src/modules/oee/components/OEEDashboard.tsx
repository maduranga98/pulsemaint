import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Activity, SlidersHorizontal } from 'lucide-react';
import { useOEEDashboard } from '../hooks/useOEE';
import type { MachineSummary } from '../types/oee.types';
import { getOEEColor, getOEEStatus } from '../types/oee.types';

// ─── Radial OEE Gauge ─────────────────────────────────────────────────────────

function OEEGauge({ value, size = 120, strokeWidth = 10 }: { value: number; size?: number; strokeWidth?: number }) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const color = getOEEColor(animated);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 80);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold font-sora" style={{ color, fontSize: size * 0.22 }}>
          {Math.round(animated)}%
        </span>
        <span className="text-xs text-slate-500 mt-0.5">OEE</span>
      </div>
    </div>
  );
}

// ─── Mini component bar ───────────────────────────────────────────────────────

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 120);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KPIStrip({
  plantAvgOEE,
  bestMachine,
  worstMachine,
  criticalCount,
}: {
  plantAvgOEE: number | null;
  bestMachine: MachineSummary | null;
  worstMachine: MachineSummary | null;
  criticalCount: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Plant Average */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-4">
        <OEEGauge value={plantAvgOEE ?? 0} size={72} strokeWidth={7} />
        <div>
          <p className="text-xs text-slate-400">Plant Average</p>
          <p className="text-lg font-bold text-white font-sora">{plantAvgOEE ?? '—'}%</p>
          <p className="text-xs text-slate-500">OEE</p>
        </div>
      </div>

      {/* Best Machine */}
      <div className="bg-slate-800/60 border border-emerald-900/40 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-slate-400">Best Machine</span>
        </div>
        <p className="font-semibold text-white text-sm truncate">{bestMachine?.machineName ?? '—'}</p>
        <p className="text-2xl font-bold text-emerald-400 font-sora">{bestMachine?.latestOEE ?? '—'}%</p>
        <p className="text-xs text-slate-500 mt-0.5">{bestMachine?.department}</p>
      </div>

      {/* Worst Machine */}
      <div className="bg-slate-800/60 border border-amber-900/40 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-4 w-4 text-amber-400" />
          <span className="text-xs text-slate-400">Worst Machine</span>
        </div>
        <p className="font-semibold text-white text-sm truncate">{worstMachine?.machineName ?? '—'}</p>
        <p className="text-2xl font-bold text-amber-400 font-sora">{worstMachine?.latestOEE ?? '—'}%</p>
        <p className="text-xs text-slate-500 mt-0.5">{worstMachine?.department}</p>
      </div>

      {/* Critical Count */}
      <div className="bg-slate-800/60 border border-red-900/40 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-xs text-slate-400">Critical (&lt;65%)</span>
        </div>
        <p className="text-4xl font-bold text-red-400 font-sora">{criticalCount}</p>
        <p className="text-xs text-slate-500 mt-1">
          {criticalCount === 0 ? 'All machines above threshold' : 'Machines need attention'}
        </p>
      </div>
    </div>
  );
}

// ─── Machine Card ─────────────────────────────────────────────────────────────

function MachineOEECard({
  machine,
  onClick,
}: {
  machine: MachineSummary;
  onClick: (m: MachineSummary) => void;
}) {
  const oee = machine.latestOEE ?? 0;
  const avail = machine.latestAvailability ?? 0;
  const perf = machine.latestPerformance ?? 0;
  const qual = machine.latestQuality ?? 0;
  const status = getOEEStatus(oee);
  const record = machine.latestRecord;

  return (
    <button
      onClick={() => onClick(machine)}
      className="w-full text-left bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 hover:border-blue-700/50 hover:bg-slate-800/80 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate group-hover:text-blue-300 transition-colors">
            {machine.machineName}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{machine.machineId} · {machine.department}</p>
        </div>
        <span
          className="ml-2 shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
          style={{ color: status.color, borderColor: `${status.color}40`, backgroundColor: `${status.color}15` }}
        >
          {status.label}
        </span>
      </div>

      {/* Gauge + components */}
      <div className="flex items-center gap-5">
        <OEEGauge value={oee} size={100} strokeWidth={9} />
        <div className="flex-1 space-y-2">
          <ComponentBar label="Availability" value={avail} color="#10B981" />
          <ComponentBar label="Performance" value={perf} color="#1A56DB" />
          <ComponentBar label="Quality" value={qual} color="#8B5CF6" />
        </div>
      </div>

      {/* Formula */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <p className="text-xs text-slate-400 font-mono">
          <span style={{ color: '#10B981' }}>{avail}%</span>
          {' × '}
          <span style={{ color: '#1A56DB' }}>{perf}%</span>
          {' × '}
          <span style={{ color: '#8B5CF6' }}>{qual}%</span>
          {' = '}
          <span style={{ color: getOEEColor(oee) }} className="font-bold">{oee}%</span>
        </p>
        {record && (
          <p className="text-[11px] text-slate-600 mt-1">
            {record.shiftDate} · {record.shift} shift
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Sort / Filter Bar ────────────────────────────────────────────────────────

type SortKey = 'oee-asc' | 'oee-desc' | 'name' | 'department';

function SortFilterBar({
  sort,
  onSort,
  filterDept,
  departments,
  onFilterDept,
}: {
  sort: SortKey;
  onSort: (s: SortKey) => void;
  filterDept: string;
  departments: string[];
  onFilterDept: (d: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>Sort:</span>
      </div>
      {(['oee-asc', 'oee-desc', 'name', 'department'] as SortKey[]).map((s) => (
        <button
          key={s}
          onClick={() => onSort(s)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            sort === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {s === 'oee-asc' ? 'OEE ↑' : s === 'oee-desc' ? 'OEE ↓' : s === 'name' ? 'Name' : 'Dept'}
        </button>
      ))}
      {departments.length > 0 && (
        <select
          value={filterDept}
          onChange={(e) => onFilterDept(e.target.value)}
          className="ml-auto px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-600"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface OEEDashboardProps {
  onMachineSelect: (machine: MachineSummary) => void;
}

export function OEEDashboard({ onMachineSelect }: OEEDashboardProps) {
  const { machines, plantAvgOEE, bestMachine, worstMachine, criticalCount, loading, error } =
    useOEEDashboard();

  const [sort, setSort] = useState<SortKey>('oee-asc');
  const [filterDept, setFilterDept] = useState('');

  const departments = [...new Set(machines.map((m) => m.department).filter(Boolean))];

  const filtered = machines
    .filter((m) => !filterDept || m.department === filterDept)
    .sort((a, b) => {
      if (sort === 'oee-asc') return (a.latestOEE ?? 0) - (b.latestOEE ?? 0);
      if (sort === 'oee-desc') return (b.latestOEE ?? 0) - (a.latestOEE ?? 0);
      if (sort === 'name') return a.machineName.localeCompare(b.machineName);
      return a.department.localeCompare(b.department);
    });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-800/40 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 bg-slate-800/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KPIStrip
        plantAvgOEE={plantAvgOEE}
        bestMachine={bestMachine}
        worstMachine={worstMachine}
        criticalCount={criticalCount}
      />

      <SortFilterBar
        sort={sort}
        onSort={setSort}
        filterDept={filterDept}
        departments={departments}
        onFilterDept={setFilterDept}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Activity className="h-10 w-10 text-slate-700 mb-3" />
          <p className="text-slate-400 font-medium">No OEE records yet</p>
          <p className="text-slate-600 text-sm mt-1">Enter OEE data to see machine performance here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MachineOEECard key={m.machineId} machine={m} onClick={onMachineSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
