import { useMemo } from 'react';
import type { PMSchedule, TechnicianWorkload } from '../../types/pm.types';
import { getWorkloadTailwindClass } from '../../utils/pm.utils';

interface TechnicianWorkloadViewProps {
  schedules: PMSchedule[];
  rangeDays: 7 | 14 | 30;
}

export function TechnicianWorkloadViewComponent({ schedules, rangeDays }: TechnicianWorkloadViewProps) {
  const workloads = useMemo(() => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + rangeDays);

    const techMap = new Map<string, TechnicianWorkload>();

    schedules.forEach((s) => {
      if (s.status !== 'active') return;
      const nextDue = s.nextDueDate instanceof Date
        ? s.nextDueDate
        : 'toDate' in s.nextDueDate ? s.nextDueDate.toDate() : new Date(s.nextDueDate as unknown as string);

      if (nextDue < now || nextDue > endDate) return;

      s.assignedTechnicianIds.forEach((techId, idx) => {
        const existing = techMap.get(techId);
        const hours = s.estimatedDurationUnit === 'days' ? s.estimatedDuration * 8 : s.estimatedDuration;

        if (existing) {
          existing.assignedCount++;
          existing.totalEstimatedHours += hours;
          existing.schedules.push({
            scheduleId: s.id,
            scheduleName: s.name,
            dueDate: nextDue,
            estimatedDuration: s.estimatedDuration,
            estimatedDurationUnit: s.estimatedDurationUnit,
            machineName: s.machineName,
            priority: s.priority,
          });
        } else {
          techMap.set(techId, {
            technicianId: techId,
            technicianName: s.assignedTechnicianNames[idx] || techId,
            assignedCount: 1,
            totalEstimatedHours: hours,
            schedules: [{
              scheduleId: s.id,
              scheduleName: s.name,
              dueDate: nextDue,
              estimatedDuration: s.estimatedDuration,
              estimatedDurationUnit: s.estimatedDurationUnit,
              machineName: s.machineName,
              priority: s.priority,
            }],
          });
        }
      });
    });

    return Array.from(techMap.values()).sort((a, b) => b.totalEstimatedHours - a.totalEstimatedHours);
  }, [schedules, rangeDays]);

  const maxHours = useMemo(() => {
    if (workloads.length === 0) return 40;
    return Math.max(...workloads.map((w) => w.totalEstimatedHours), 40);
  }, [workloads]);

  return (
    <div className="space-y-4">
      {workloads.map((tech) => {
        const barWidth = Math.min((tech.totalEstimatedHours / maxHours) * 100, 100);
        const barClass = getWorkloadTailwindClass(tech.totalEstimatedHours);

        return (
          <div key={tech.technicianId} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{tech.technicianName}</h3>
                <p className="text-xs text-gray-500">{tech.assignedCount} PMs • {tech.totalEstimatedHours}h est.</p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  tech.totalEstimatedHours <= 20
                    ? 'bg-emerald-100 text-emerald-800'
                    : tech.totalEstimatedHours <= 40
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {tech.totalEstimatedHours <= 20 ? 'OK' : tech.totalEstimatedHours <= 40 ? 'Busy' : 'Overloaded'}
              </span>
            </div>

            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full ${barClass} rounded-full transition-all`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            <div className="space-y-1.5">
              {tech.schedules.slice(0, 5).map((s) => (
                <div
                  key={s.scheduleId}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        s.priority === 'critical'
                          ? 'bg-red-500'
                          : s.priority === 'high'
                          ? 'bg-amber-500'
                          : s.priority === 'medium'
                          ? 'bg-yellow-400'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <span className="truncate text-gray-700">{s.scheduleName}</span>
                    <span className="text-gray-400 flex-shrink-0">({s.machineName})</span>
                  </div>
                  <span className="text-gray-500 flex-shrink-0">
                    {s.dueDate.toLocaleDateString()} • {s.estimatedDuration}{s.estimatedDurationUnit === 'days' ? 'd' : 'h'}
                  </span>
                </div>
              ))}
              {tech.schedules.length > 5 && (
                <p className="text-xs text-gray-400 pl-2">+{tech.schedules.length - 5} more</p>
              )}
            </div>
          </div>
        );
      })}

      {workloads.length === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm">No upcoming PM assignments in this range.</div>
      )}
    </div>
  );
}
