import { Users, Clock } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useTodayShifts } from '../../../hooks/dashboard/useTodayShifts';

interface Props {
  companyId: string;
}

export default function TodayShiftsByDepartment({ companyId }: Props) {
  const { departments, loading, error } = useTodayShifts(companyId);

  return (
    <DashboardWidget title="Today's Shifts by Department" loading={loading} error={error}>
      {departments.length === 0 ? (
        <EmptyState message="No shifts configured for today" />
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {departments.map((dept) => (
            <div key={dept.department}>
              <h4 className="text-xs font-semibold text-[#8BA3BF] uppercase tracking-wide mb-2">
                {dept.department}
              </h4>
              <div className="space-y-2">
                {dept.shifts.map((shift) => (
                  <div
                    key={shift.shiftName}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                      shift.isActive
                        ? 'bg-[#10B981]/10 border-[#10B981]/30'
                        : 'bg-[#0A1628] border-[#1E3A5F]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: shift.color || '#1A56DB' }}
                      />
                      <span className="text-sm font-medium text-[#F0F4F8]">{shift.shiftName}</span>
                      {shift.isActive && (
                        <span className="text-[10px] font-semibold text-[#10B981] uppercase tracking-wider">
                          Active
                        </span>
                      )}
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
