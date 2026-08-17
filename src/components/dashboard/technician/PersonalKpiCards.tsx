import { useMemo } from 'react';
import { Wrench, Timer, Clock, Shield } from 'lucide-react';
import { useMyCompletedWorkOrders } from '../../../hooks/dashboard/useMyCompletedWorkOrders';
import { formatDurationMinutes } from '../../../utils/analytics.utils';
import { useTranslation } from 'react-i18next';

interface PersonalKpiCardsProps {
  technicianId: string;
  siteId: string;
}

export default function PersonalKpiCards({ technicianId }: PersonalKpiCardsProps) {
  const { t } = useTranslation();
  // Completed work is excluded from the active job queue, so the KPIs read from
  // a dedicated live query of the technician's finished work orders.
  const { workOrders: completed } = useMyCompletedWorkOrders(technicianId);

  const stats = useMemo(() => {
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
  }, [completed]);

  const cards = [
    { label: t('common.widgets.personalKpiCards.jobsCompleted'), value: stats.jobsCompleted, icon: <Wrench className="w-5 h-5" />, color: 'text-[#1A56DB]' },
    { label: t('common.widgets.personalKpiCards.avgResponse'), value: formatDurationMinutes(stats.avgResponseMins), icon: <Timer className="w-5 h-5" />, color: 'text-[#00C2FF]' },
    { label: t('common.widgets.personalKpiCards.avgRepair'), value: formatDurationMinutes(stats.avgRepairMins), icon: <Clock className="w-5 h-5" />, color: 'text-[#F59E0B]' },
    { label: t('common.widgets.personalKpiCards.slaCompliance'), value: `${stats.slaCompliance}%`, icon: <Shield className="w-5 h-5" />, color: 'text-[#10B981]' },
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
