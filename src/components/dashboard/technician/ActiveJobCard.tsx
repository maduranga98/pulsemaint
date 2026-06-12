import { useState, useEffect } from 'react';
import { Clock, CheckCircle, Camera, Package, Wrench } from 'lucide-react';
import { formatDurationSeconds } from '../../../utils/analytics.utils';
import type { WorkOrder } from '../../../types';

interface ActiveJobCardProps {
  workOrder: WorkOrder | null;
  onOpen?: (workOrder: WorkOrder) => void;
}

export default function ActiveJobCard({ workOrder, onOpen }: ActiveJobCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!workOrder?.actualStartTime) return;
    const start = workOrder.actualStartTime.toDate().getTime();
    const update = () => setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [workOrder?.actualStartTime]);

  if (!workOrder) {
    return (
      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-6 text-center">
        <Wrench className="w-10 h-10 text-[#8BA3BF] mx-auto mb-3" />
        <p className="text-sm text-[#F0F4F8] font-medium">No active job</p>
        <p className="text-xs text-[#8BA3BF] mt-1">Scan machine QR to check in</p>
      </div>
    );
  }

  const completedSteps = workOrder.checklist?.filter((c) => c.isCompleted).length ?? 0;
  const totalSteps = workOrder.checklist?.length ?? 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#8BA3BF] uppercase tracking-wide">Current Job</p>
          <p className="text-lg font-bold text-[#F0F4F8] font-[Sora] mt-1">{workOrder.woNumber}</p>
          <p className="text-sm text-[#8BA3BF] mt-0.5">{workOrder.machineName} · {workOrder.machineLocation}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-[#00C2FF]">
            <Clock className="w-4 h-4" />
            <span className="text-xl font-bold font-mono">{formatDurationSeconds(elapsedSeconds)}</span>
          </div>
          <p className="text-[10px] text-[#8BA3BF] mt-0.5">Time on job</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-[#8BA3BF]">Checklist Progress</span>
          <span className="text-[#F0F4F8]">{completedSteps} of {totalSteps}</span>
        </div>
        <div className="h-2 bg-[#0A1628] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1A56DB] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onOpen?.(workOrder)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1A56DB] text-white text-xs font-medium rounded-lg hover:bg-[#1A56DB]/90 transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Update Status
        </button>
        <button
          onClick={() => onOpen?.(workOrder)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0A1628] border border-[#1E3A5F] text-[#F0F4F8] text-xs font-medium rounded-lg hover:border-[#2E5A8F] transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          Add Photo
        </button>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0A1628] border border-[#1E3A5F] text-[#F0F4F8] text-xs font-medium rounded-lg hover:border-[#2E5A8F] transition-colors">
          <Package className="w-3.5 h-3.5" />
          Request Parts
        </button>
      </div>
    </div>
  );
}
