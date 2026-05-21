import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePMSchedules } from '../../hooks/pm/usePMSchedules';
import { usePMHistory } from '../../hooks/pm/usePMHistory';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { PMStatusBadge, PMOperationalStatusBadge } from '../../components/pm/PMStatusBadge';
import { PMPriorityBadge } from '../../components/pm/PMPriorityBadge';
import { PMChecklistBuilder } from '../../components/pm/PMChecklistBuilder';
import { PM_TYPE_CONFIG, RECURRENCE_TYPE_LABELS, PM_HISTORY_STATUS_LABELS } from '../../constants/pmConfig';
import { getPMOperationalStatus, getDaysUntilDue, getComplianceColor } from '../../utils/pm.utils';

export default function PMScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const company = useAuthStore((s) => s.company);
  const isSupervisor = useAuthStore((s) => s.isSupervisor || s.isAdmin);

  const { schedules, pauseSchedule, activateSchedule, triggerManualPM } = usePMSchedules({
    companyId: company?.id || '',
  });
  const schedule = schedules.find((s) => s.id === id);

  const { history } = usePMHistory({ companyId: company?.id || '', scheduleId: id });
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [showTriggerModal, setShowTriggerModal] = useState(false);

  if (!schedule) {
    return <div className="p-8 text-center text-gray-400">Schedule not found.</div>;
  }

  const opStatus = getPMOperationalStatus(schedule);
  const daysUntilDue = getDaysUntilDue(schedule.nextDueDate);

  const handleStatusToggle = async () => {
    try {
      if (schedule.status === 'active') {
        await pauseSchedule(schedule.id);
        toast.success('Schedule paused');
      } else if (schedule.status === 'paused') {
        await activateSchedule(schedule.id);
        toast.success('Schedule activated');
      }
    } catch {
      toast.error('Action failed');
    }
  };

  const handleTriggerNow = async () => {
    try {
      await triggerManualPM(schedule.id);
      toast.success('Manual PM triggered');
      setShowTriggerModal(false);
    } catch {
      toast.error('Trigger failed');
    }
  };

  const nextDue = schedule.nextDueDate instanceof Date
    ? schedule.nextDueDate
    : (schedule.nextDueDate as any).toDate ? (schedule.nextDueDate as any).toDate() : new Date(schedule.nextDueDate as any);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{schedule.name}</h1>
            <PMOperationalStatusBadge status={opStatus} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {PM_TYPE_CONFIG[schedule.pmType].icon} {PM_TYPE_CONFIG[schedule.pmType].label} • {schedule.machineName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSupervisor && (
            <>
              <button
                onClick={() => setShowTriggerModal(true)}
                className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
              >
                Trigger Now
              </button>
              <button
                onClick={handleStatusToggle}
                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                  schedule.status === 'active'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                {schedule.status === 'active' ? 'Pause' : 'Activate'}
              </button>
              <button
                onClick={() => navigate(`/app/pm-schedules/${schedule.id}/edit`)}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Compliance card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Compliance Rate</p>
          <p className="text-2xl font-bold" style={{ color: getComplianceColor(schedule.complianceRate) }}>
            {schedule.complianceRate}%
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Next Due</p>
          <p className={`text-lg font-semibold ${daysUntilDue < 0 ? 'text-red-600' : daysUntilDue <= 7 ? 'text-amber-600' : 'text-gray-900'}`}>
            {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'Today' : `${daysUntilDue}d`}
          </p>
          <p className="text-xs text-gray-400">{nextDue.toLocaleDateString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-gray-900">{schedule.completedOnTime + schedule.completedLate}</p>
          <p className="text-xs text-gray-400">{schedule.missed} missed</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Status</p>
          <div className="mt-1">
            <PMStatusBadge status={schedule.status} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['overview', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'overview' ? 'Overview' : 'History'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          {/* Schedule Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Schedule Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between sm:block">
                <span className="text-gray-500">Priority</span>
                <PMPriorityBadge priority={schedule.priority} />
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-gray-500">Trigger Type</span>
                <span className="font-medium">{schedule.triggerType === 'calendar' ? 'Calendar-Based' : 'Usage-Based'}</span>
              </div>
              {schedule.triggerType === 'calendar' && (
                <>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Recurrence</span>
                    <span className="font-medium">{RECURRENCE_TYPE_LABELS[schedule.recurrenceType]}</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">End Date</span>
                    <span className="font-medium">{schedule.noEndDate ? 'No end date' : schedule.endDate ? schedule.endDate.toDate().toLocaleDateString() : '—'}</span>
                  </div>
                </>
              )}
              {schedule.triggerType === 'usage' && (
                <>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Trigger After</span>
                    <span className="font-medium">{schedule.triggerAfterValue} {schedule.triggerUnit?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Current Meter</span>
                    <span className="font-medium">{schedule.currentMeterValue ?? '—'}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between sm:block">
                <span className="text-gray-500">Est. Duration</span>
                <span className="font-medium">{schedule.estimatedDuration} {schedule.estimatedDurationUnit}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-gray-500">Lead Time</span>
                <span className="font-medium">{schedule.leadTimeDays} day(s)</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-gray-500">Escalation</span>
                <span className="font-medium">{schedule.overdueEscalationHours}h</span>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Checklist</h3>
            <PMChecklistBuilder items={schedule.checklistItems} onChange={() => {}} readOnly />
          </div>

          {/* Parts */}
          {schedule.preallocatedParts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Pre-allocated Parts</h3>
              <div className="space-y-2">
                {schedule.preallocatedParts.map((part, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{part.partName}</span>
                    <span className="text-gray-500">Qty: {part.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">WO #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Due Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Completed</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Technicians</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600">{h.woNumber}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {h.dueDate instanceof Date
                      ? h.dueDate.toLocaleDateString()
                      : h.dueDate.toDate().toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {h.completedDate
                      ? (h.completedDate instanceof Date
                          ? h.completedDate.toLocaleDateString()
                          : h.completedDate.toDate().toLocaleDateString())
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        h.status === 'completed_on_time'
                          ? 'bg-emerald-100 text-emerald-800'
                          : h.status === 'completed_late'
                          ? 'bg-amber-100 text-amber-800'
                          : h.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {PM_HISTORY_STATUS_LABELS[h.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{h.technicianNames.join(', ')}</td>
                  <td className="px-4 py-3 text-gray-600">{h.duration ? `${h.duration}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No history yet.</div>
          )}
        </div>
      )}

      {/* Trigger Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900">Trigger Manual PM?</h3>
            <p className="text-sm text-gray-500 mt-2">
              This will immediately create a PM Work Order for {schedule.name} regardless of the schedule.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowTriggerModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerNow}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
              >
                Trigger Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
