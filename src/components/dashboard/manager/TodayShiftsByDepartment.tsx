import { useMemo } from 'react';
import { Users, Clock } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useTodayShifts } from '../../../hooks/dashboard/useTodayShifts';

interface Props {
  companyId: string;
}

export default function TodayShiftsByDepartment({ companyId }: Props) {
  const { departments, loading, error } = useTodayShifts(companyId);

  // Only shifts that have actually started (clocked-in or within their time
  // window) are worth showing live — a department with none right now drops
  // out entirely rather than showing an empty section.
  const activeDepartments = useMemo(
    () =>
      departments
        .map((dept) => ({ ...dept, shifts: dept.shifts.filter((s) => s.isActive) }))
        .filter((dept) => dept.shifts.length > 0),
    [departments],
  );

  const totalStarted = activeDepartments.reduce((sum, dept) => sum + dept.shifts.length, 0);

  return (
    <DashboardWidget
      title="Today's Shifts by Department"
      loading={loading}
      error={error}
      live
      action={<span className="text-xs text-[#8BA3BF]">{totalStarted} started</span>}
    >
      {activeDepartments.length === 0 ? (
        <EmptyState message="No active shifts right now" />
      ) : (
        <div className="space-y-4">
          {activeDepartments.map((dept) => (
            <div key={dept.department}>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-[#8BA3BF] uppercase tracking-wide mb-2">
                {dept.department}
                <span className="rounded-full bg-[#10B981]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#10B981]">
                  {dept.shifts.length} started
                </span>
              </h4>
              <div className="space-y-2">
                {dept.shifts.map((shift) => (
                  <div
                    key={shift.shiftName}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border bg-[#10B981]/10 border-[#10B981]/30"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: shift.color || '#1A56DB' }}
                      />
                      <span className="text-sm font-medium text-[#F0F4F8]">{shift.shiftName}</span>
                      <span className="text-[10px] font-semibold text-[#10B981] uppercase tracking-wider">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#8BA3BF]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {shift.startTime} – {shift.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {shift.memberCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
