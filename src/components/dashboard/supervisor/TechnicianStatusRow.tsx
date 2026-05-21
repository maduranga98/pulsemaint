import { useDashboardStore } from '../../../store/dashboard.store';
import type { TechnicianStatusDoc } from '../../../types/analytics.types';

const STATUS_CONFIG: Record<string, { dot: string; label: string; pulse: boolean }> = {
  available: { dot: 'bg-[#10B981]', label: 'Available', pulse: false },
  on_job: { dot: 'bg-[#1A56DB]', label: 'On Job', pulse: true },
  on_break: { dot: 'bg-[#F59E0B]', label: 'On Break', pulse: false },
  off_shift: { dot: 'bg-[#374151]', label: 'Off Shift', pulse: false },
};

interface TechnicianStatusRowProps {
  technician: TechnicianStatusDoc;
}

export default function TechnicianStatusRow({ technician }: TechnicianStatusRowProps) {
  const config = STATUS_CONFIG[technician.currentStatus] ?? STATUS_CONFIG.available;
  const setSidePanel = useDashboardStore((s) => s.setSidePanel);

  return (
    <div
      onClick={() => setSidePanel({ type: 'technician', id: technician.userId })}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-[#1E3A5F]/30 transition-colors cursor-pointer ${
        technician.currentStatus === 'on_job' ? 'border-l-2 border-l-[#1A56DB]' : ''
      }`}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-[#1A56DB]/20 text-[#1A56DB] flex items-center justify-center text-xs font-bold shrink-0">
        {technician.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#F0F4F8] truncate">{technician.name}</p>
          <span className="inline-flex items-center gap-1 text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`} />
            <span className="text-[#8BA3BF]">{config.label}</span>
          </span>
        </div>

        {technician.currentWoNumber && (
          <p className="text-[11px] text-[#8BA3BF] truncate mt-0.5">
            {technician.currentWoNumber} · {technician.currentMachineName}
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-[#F0F4F8]">{technician.jobsCompletedToday}</p>
        <p className="text-[10px] text-[#8BA3BF]">Done today</p>
      </div>
    </div>
  );
}
