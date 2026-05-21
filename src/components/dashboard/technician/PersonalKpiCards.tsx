import { useMemo } from 'react';
import { Wrench, Timer, Clock, Shield } from 'lucide-react';
import { useMyJobQueue } from '../../../hooks/dashboard/useMyJobQueue';
import { formatDurationMinutes } from '../../../utils/analytics.utils';
import type { WorkOrder } from '../../../types';

interface PersonalKpiCardsProps {
  technicianId: string;
  siteId: string;
}

export default function PersonalKpiCards({ technicianId, siteId }: PersonalKpiCardsProps) {
  const { workOrders } = useMyJobQueue(technicianId, siteId);

  const stats = useMemo(() => {
    const completed = workOrders.filter((wo: WorkOrder) => wo.status === 'COMPLETED');
    const totalResponseMins = completed.reduce((sum, wo) => {
      const reported = wo.createdAt?.toDate?.().getTime() ?? 0;
      const started = wo.actualStartTime?.toDate?.().getTime() ?? 0;
      if (reported && started) return sum + (started - reported) / 60000;
      return sum;
    }, 0);
    const totalRepairMins = completed.reduce((sum, wo) => {
      const started = wo.actualStartTime?.toDate?.().getTime() ?? 0;
      const ended = wo.actualEndTime?.toDate?.().getTime() ?? 0;
      if (started && ended) return sum + (ended - started) / 60000;
      return sum;
    }, 0);

    const slaCompliant = completed.filter((wo) => !wo.slaBreached).length;
    const total = completed.length || 1;

    return {
      jobsCompleted: completed.length,
      avgResponseMins: completed.length ? totalResponseMins / completed.length : 0,
      avgRepairMins: completed.length ? totalRepairMins / completed.length : 0,
      slaCompliance: Math.round((slaCompliant / total) * 100),
    };
  }, [workOrders]);

  const cards = [
    { label: 'Jobs Completed', value: stats.jobsCompleted, icon: <Wrench className="w-5 h-5" />, color: 'text-[#1A56DB]' },
    { label: 'Avg Response', value: formatDurationMinutes(stats.avgResponseMins), icon: <Timer className="w-5 h-5" />, color: 'text-[#00C2FF]' },
    { label: 'Avg Repair', value: formatDurationMinutes(stats.avgRepairMins), icon: <Clock className="w-5 h-5" />, color: 'text-[#F59E0B]' },
    { label: 'SLA Compliance', value: `${stats.slaCompliance}%`, icon: <Shield className="w-5 h-5" />, color: 'text-[#10B981]' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 hover:border-[#2E5A8F] transition-colors"
        >
          <div className={`${card.color} mb-2`}>{card.icon}</div>
          <p className="text-xl font-bold text-[#F0F4F8] font-[Sora]">{card.value}</p>
          <p className="text-[11px] text-[#8BA3BF] mt-0.5">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
