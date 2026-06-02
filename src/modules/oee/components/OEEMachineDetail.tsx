import { useEffect, useState } from 'react';
import { X, Plus, Database, User } from 'lucide-react';
import { useOEEByMachine } from '../hooks/useOEE';
import type { MachineSummary, OEERecord } from '../types/oee.types';
import { getOEEColor } from '../types/oee.types';
import { OEEInputForm } from './OEEInputForm';

// ─── Radial Gauge ─────────────────────────────────────────────────────────────

function OEEGauge({ value, size, strokeWidth, label }: { value: number; size: number; strokeWidth: number; label?: string }) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = getOEEColor(animated);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 100);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (animated / 100) * circumference}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold font-sora" style={{ color, fontSize: size * 0.22 }}>
            {Math.round(animated)}%
          </span>
        </div>
      </div>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );
}

// ─── History Table ────────────────────────────────────────────────────────────

function HistoryTable({ records }: { records: OEERecord[] }) {
  const shiftLabel = (s: string) => ({ day: 'Day', evening: 'Eve', night: 'Ngt' }[s] ?? s);

  if (records.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-8">No records yet for this machine.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700/60">
            {['Date', 'Shift', 'OEE', 'Avail', 'Perf', 'Quality', 'Source'].map((h) => (
              <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
              <td className="py-2 px-3 text-slate-300">{r.shiftDate}</td>
              <td className="py-2 px-3">
                <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{shiftLabel(r.shift)}</span>
              </td>
              <td className="py-2 px-3">
                <span className="font-semibold" style={{ color: getOEEColor(r.oee) }}>{r.oee}%</span>
              </td>
              <td className="py-2 px-3 text-emerald-400">{r.availability}%</td>
              <td className="py-2 px-3 text-blue-400">{r.performance}%</td>
              <td className="py-2 px-3 text-purple-400">{r.quality}%</td>
              <td className="py-2 px-3">
                {r.dataSource === 'semi-auto' ? (
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Database className="h-3 w-3" /> Auto
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-500">
                    <User className="h-3 w-3" /> Manual
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

interface OEEMachineDetailProps {
  machine: MachineSummary | null;
  onClose: () => void;
  isProPlan?: boolean;
}

export function OEEMachineDetail({ machine, onClose, isProPlan }: OEEMachineDetailProps) {
  const [showForm, setShowForm] = useState(false);
  const { records, loading } = useOEEByMachine(machine?.machineId ?? '');

  const latest = records[0];
  const oee = latest?.oee ?? machine?.latestOEE ?? 0;
  const avail = latest?.availability ?? machine?.latestAvailability ?? 0;
  const perf = latest?.performance ?? machine?.latestPerformance ?? 0;
  const qual = latest?.quality ?? machine?.latestQuality ?? 0;

  useEffect(() => {
    if (machine) setShowForm(false);
  }, [machine?.machineId]);

  if (!machine) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-slate-900 border-l border-slate-700/60 z-50 overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div>
            <h2 className="font-bold text-white font-sora">{machine.machineName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{machine.machineId} · {machine.department}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-6">
          {showForm ? (
            <div>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs text-slate-400 hover:text-white mb-4 flex items-center gap-1"
              >
                ← Back to detail
              </button>
              <OEEInputForm
                prefillMachineId={machine.machineId}
                prefillMachineName={machine.machineName}
                isProPlan={isProPlan}
                onSuccess={() => setShowForm(false)}
              />
            </div>
          ) : (
            <>
              {/* OEE Gauges */}
              <div className="bg-slate-800/50 rounded-2xl p-5">
                <div className="flex items-center gap-6 flex-wrap">
                  <OEEGauge value={oee} size={120} strokeWidth={11} />
                  <div className="flex gap-6">
                    <OEEGauge value={avail} size={80} strokeWidth={8} label="Availability" />
                    <OEEGauge value={perf} size={80} strokeWidth={8} label="Performance" />
                    <OEEGauge value={qual} size={80} strokeWidth={8} label="Quality" />
                  </div>
                </div>

                {/* Formula */}
                <div className="mt-4 pt-4 border-t border-slate-700/50 text-center">
                  <p className="text-sm font-mono text-slate-400">
                    <span style={{ color: '#10B981' }}>{avail}%</span>
                    <span className="text-slate-600"> × </span>
                    <span style={{ color: '#1A56DB' }}>{perf}%</span>
                    <span className="text-slate-600"> × </span>
                    <span style={{ color: '#8B5CF6' }}>{qual}%</span>
                    <span className="text-slate-600"> = </span>
                    <span style={{ color: getOEEColor(oee) }} className="font-bold text-base">{oee}%</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">A × P × Q = OEE</p>
                </div>
              </div>

              {/* History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">History (last 30)</h3>
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Record
                  </button>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-8 bg-slate-800/40 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <HistoryTable records={records} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
