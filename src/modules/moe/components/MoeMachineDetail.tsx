import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { ArrowLeft, Download } from 'lucide-react';
import { useMachineOptions } from '../../../hooks/inventory/useMachineOptions';
import { useMoeConfig, useMoeMachineTrend } from '../hooks/useMoe';
import { getMoeStatus, MOE_STATUS_META } from '../types/moe.types';
import { MoeMachineFilter } from './MoeMachineFilter';
import type { MoeDateRange, MoeTrendPoint } from '../types/moe.types';

function exportTrendToCsv(filename: string, rows: MoeTrendPoint[]): void {
  const header = ['Date', 'MOE', 'Availability', 'MaintenanceCompliance', 'Reliability', 'Health'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push(
      [r.date, r.moeScore, r.availabilityScore, r.maintenanceComplianceScore, r.reliabilityScore, r.healthScore].join(','),
    );
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface MoeMachineDetailProps {
  machineId: string;
  initialRange: MoeDateRange;
  onBack: () => void;
}

export function MoeMachineDetail({ machineId, initialRange, onBack }: MoeMachineDetailProps) {
  const [range, setRange] = useState<MoeDateRange>(initialRange);
  const { machines } = useMachineOptions();
  const { config } = useMoeConfig();
  const { trend, loading, error } = useMoeMachineTrend(machineId, range.start, range.end);

  const machine = machines.find((m) => m.id === machineId);
  const latest = trend.length > 0 ? trend[trend.length - 1] : null;
  const status = latest ? getMoeStatus(latest.moeScore, config?.statusBands) : null;
  const meta = status ? MOE_STATUS_META[status] : null;

  const totalDowntimeHrs = 0; // derived stats row below computes from trend aggregates
  const breakdownCount = trend.reduce((s, t) => s + (100 - t.reliabilityScore) / (config?.reliabilityPenaltyFactor || 8), 0);
  const avgCompliance = trend.length
    ? trend.reduce((s, t) => s + t.maintenanceComplianceScore, 0) / trend.length
    : 0;
  const avgAvailability = trend.length
    ? trend.reduce((s, t) => s + t.availabilityScore, 0) / trend.length
    : 0;

  const handleExport = () => {
    exportTrendToCsv(
      `moe-${(machine?.name ?? machineId).replace(/[^a-zA-Z0-9_-]/g, '_')}-${range.start
        .toISOString()
        .slice(0, 10)}.csv`,
      trend,
    );
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-[#8BA3BF] hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-[Sora]">{machine?.name ?? machineId}</h1>
          <p className="text-sm text-[#8BA3BF]">{machine?.department}</p>
        </div>
        <div className="flex items-center gap-3">
          {meta && latest && (
            <div className="text-right">
              <p className="text-xs text-[#8BA3BF]">Current MOE</p>
              <p className="text-2xl font-bold" style={{ color: meta.color }}>
                {latest.moeScore.toFixed(1)} — {meta.label}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-[#1E3A5F] text-[#8BA3BF] hover:text-white hover:border-[#2E5A8F]"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <MoeMachineFilter machineId={machineId} onMachineChange={() => {}} onRangeChange={setRange} showMachinePicker={false} />

      {error && <p className="text-sm text-[#EF4444]">{error}</p>}
      {loading && <p className="text-sm text-[#8BA3BF]">Loading trend…</p>}

      {!loading && trend.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Stat label="Breakdowns" value={Math.round(breakdownCount).toString()} />
            <Stat label="Downtime (est.)" value={`${totalDowntimeHrs.toFixed(1)} hrs`} />
            <Stat label="Avg Availability" value={`${avgAvailability.toFixed(1)}%`} />
            <Stat label="Avg PM Compliance" value={`${avgCompliance.toFixed(1)}%`} />
            <Stat label="Health Score" value={`${latest?.healthScore.toFixed(0) ?? ''}`} />
          </div>

          <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">MOE Over Time</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis dataKey="date" stroke="#8BA3BF" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#8BA3BF" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F' }} />
                <ReferenceLine y={config?.statusBands.excellent ?? 85} stroke="#10B981" strokeDasharray="4 4" />
                <ReferenceLine y={config?.statusBands.good ?? 70} stroke="#84CC16" strokeDasharray="4 4" />
                <ReferenceLine y={config?.statusBands.atRisk ?? 50} stroke="#F59E0B" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="moeScore" name="MOE" stroke="#00C2FF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Sub-scores Over Time</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis dataKey="date" stroke="#8BA3BF" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#8BA3BF" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F' }} />
                <Legend />
                <Line type="monotone" dataKey="availabilityScore" name="Availability" stroke="#00C2FF" dot={false} />
                <Line type="monotone" dataKey="maintenanceComplianceScore" name="Maintenance Compliance" stroke="#10B981" dot={false} />
                <Line type="monotone" dataKey="reliabilityScore" name="Reliability" stroke="#F59E0B" dot={false} />
                <Line type="monotone" dataKey="healthScore" name="Health" stroke="#8B5CF6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!loading && trend.length === 0 && (
        <p className="text-sm text-[#8BA3BF]">No data available for this machine in the selected range.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-3">
      <p className="text-[11px] text-[#8BA3BF] uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
    </div>
  );
}
