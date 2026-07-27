import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { useMoeDashboard } from '../hooks/useMoe';
import { MoeMachineFilter, buildRange } from './MoeMachineFilter';
import { getMoeStatus, MOE_STATUS_META } from '../types/moe.types';
import type { MoeDateRange, MoeMachineSummary } from '../types/moe.types';

interface MoeDashboardProps {
  onSelectMachine: (machineId: string, range: MoeDateRange) => void;
  onOpenConfig?: () => void;
  canConfigure?: boolean;
}

function MachineRow({ m, onClick }: { m: MoeMachineSummary; onClick: () => void }) {
  const status = getMoeStatus(m.moeScore);
  const meta = MOE_STATUS_META[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#132743] transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm text-white font-medium truncate">{m.machineName}</p>
        <p className="text-xs text-[#8BA3BF] truncate">
          {m.department} · Criticality {m.criticality}
          {m.isCritical && <span className="ml-1 text-[#EF4444] font-semibold">CRITICAL</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg font-bold" style={{ color: meta.color }}>
          {m.moeScore.toFixed(1)}
        </span>
      </div>
    </button>
  );
}

export function MoeDashboard({ onSelectMachine, onOpenConfig, canConfigure }: MoeDashboardProps) {
  const [range, setRange] = useState<MoeDateRange>(() => buildRange('30d'));
  const { data, loading, error } = useMoeDashboard(range.start, range.end);

  const plantStatus = data ? getMoeStatus(data.plantAverageMoe) : null;
  const plantMeta = plantStatus ? MOE_STATUS_META[plantStatus] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-[Sora]">MOE — Machine Overall Effectiveness</h1>
          <p className="text-sm text-[#8BA3BF] mt-1">
            Composite score from availability, maintenance compliance, reliability, and health data already in the
            system.
          </p>
        </div>
        {canConfigure && onOpenConfig && (
          <button
            type="button"
            onClick={onOpenConfig}
            className="px-3 py-2 text-sm rounded-lg border border-[#1E3A5F] text-[#8BA3BF] hover:text-white hover:border-[#2E5A8F]"
          >
            Configure weights
          </button>
        )}
      </div>

      <MoeMachineFilter
        machineId={null}
        onMachineChange={() => {}}
        onRangeChange={setRange}
        showMachinePicker={false}
      />

      {error && <p className="text-sm text-[#EF4444]">{error}</p>}
      {loading && <p className="text-sm text-[#8BA3BF]">Calculating MOE…</p>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 border-l-4" style={{ borderLeftColor: plantMeta?.color }}>
              <p className="text-[11px] font-medium text-[#8BA3BF] uppercase tracking-wide">Plant Average MOE</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold" style={{ color: plantMeta?.color }}>
                  {data.plantAverageMoe.toFixed(1)}
                </span>
                {data.previousPeriodMoe !== null && (
                  <span className="flex items-center gap-1 text-xs text-[#8BA3BF]">
                    {data.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />}
                    {data.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />}
                    {data.trend === 'flat' && <Minus className="w-3.5 h-3.5" />}
                    vs {data.previousPeriodMoe.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8BA3BF] mt-1">Criticality-weighted, {range.label.toLowerCase()}</p>
            </div>

            <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 border-l-4 border-l-[#EF4444]">
              <p className="text-[11px] font-medium text-[#8BA3BF] uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Critical Machines
              </p>
              <div className="mt-2 text-3xl font-bold text-[#EF4444]">{data.criticalMachines.length}</div>
              <p className="text-xs text-[#8BA3BF] mt-1">Criticality 4–5 and below threshold</p>
            </div>

            <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4">
              <p className="text-[11px] font-medium text-[#8BA3BF] uppercase tracking-wide">Machines Tracked</p>
              <div className="mt-2 text-3xl font-bold text-white">{data.allMachines.length}</div>
            </div>

            <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4">
              <p className="text-[11px] font-medium text-[#8BA3BF] uppercase tracking-wide">Excellent (≥85)</p>
              <div className="mt-2 text-3xl font-bold text-[#10B981]">
                {data.allMachines.filter((m) => m.moeScore >= 85).length}
              </div>
            </div>
          </div>

          {data.criticalMachines.length > 0 && (
            <div className="bg-[#1A0F0F] border border-[#EF4444]/40 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#EF4444] mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Critical Machines
              </h2>
              <div className="divide-y divide-[#1E3A5F]">
                {data.criticalMachines.map((m) => (
                  <MachineRow key={m.machineId} m={m} onClick={() => onSelectMachine(m.machineId, range)} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-2">Top 10 Best Machines</h2>
              <div className="divide-y divide-[#1E3A5F]">
                {data.bestMachines.length === 0 && <p className="text-sm text-[#8BA3BF] py-2">No data yet.</p>}
                {data.bestMachines.map((m) => (
                  <MachineRow key={m.machineId} m={m} onClick={() => onSelectMachine(m.machineId, range)} />
                ))}
              </div>
            </div>
            <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-2">Top 10 Worst Machines</h2>
              <div className="divide-y divide-[#1E3A5F]">
                {data.worstMachines.length === 0 && <p className="text-sm text-[#8BA3BF] py-2">No data yet.</p>}
                {data.worstMachines.map((m) => (
                  <MachineRow key={m.machineId} m={m} onClick={() => onSelectMachine(m.machineId, range)} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
