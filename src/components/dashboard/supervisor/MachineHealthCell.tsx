import { useState } from 'react';
import type { MachineHealthDoc } from '../../../types/analytics.types';

const STATUS_COLORS: Record<string, string> = {
  operational: '#10B981',
  breakdown: '#EF4444',
  maintenance: '#F59E0B',
  pm_in_progress: '#1A56DB',
  decommissioned: '#374151',
};

interface MachineHealthCellProps {
  machine: MachineHealthDoc;
  onClick?: (machineId: string) => void;
}

export default function MachineHealthCell({ machine, onClick }: MachineHealthCellProps) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[machine.currentStatus] ?? '#8BA3BF';
  const isCritical = machine.currentStatus === 'breakdown';

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => onClick?.(machine.machineId)}
        className={`w-full aspect-square rounded-lg border flex items-center justify-center text-[10px] font-medium transition-all ${
          isCritical ? 'animate-pulse' : ''
        }`}
        style={{
          backgroundColor: `${color}15`,
          borderColor: `${color}40`,
          color,
        }}
      >
        <span className="truncate px-1">{machine.machineIdCode || machine.machineName.slice(0, 4)}</span>
        {/* Status dot */}
        <span
          className="absolute top-1 right-1 w-2 h-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: isCritical ? `0 0 6px ${color}` : 'none' }}
        />
      </button>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-[#0F1E35] border border-[#1E3A5F] rounded-lg shadow-xl text-left pointer-events-none">
          <p className="text-xs font-semibold text-[#F0F4F8]">{machine.machineName}</p>
          <p className="text-[11px] text-[#8BA3BF] mt-0.5">{machine.location}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#8BA3BF]">Status</span>
              <span style={{ color }} className="capitalize">{machine.currentStatus.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#8BA3BF]">Health</span>
              <span className="text-[#F0F4F8]">{machine.healthScore}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#8BA3BF]">Open WOs</span>
              <span className="text-[#F0F4F8]">{machine.openWoCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
