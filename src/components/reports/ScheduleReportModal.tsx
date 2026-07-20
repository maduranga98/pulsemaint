import { useEffect, useState } from 'react';
import { CalendarClock, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ReportConfig, ReportSchedule, ReportScheduleFrequency, ReportType } from '../../types/reports.types';
import {
  createReportSchedule,
  deleteReportSchedule,
  fetchReportSchedules,
  setReportScheduleActive,
} from '../../services/reports.service';
import { useAuthStore } from '../../store/authStore';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  reportType: ReportType;
  config: ReportConfig;
  companyId: string;
  onClose: () => void;
}

export default function ScheduleReportModal({ reportType, config, companyId, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [frequency, setFrequency] = useState<ReportScheduleFrequency>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [recipientsInput, setRecipientsInput] = useState(user?.email ?? '');

  async function load() {
    setLoading(true);
    try {
      setSchedules(await fetchReportSchedules(companyId, reportType));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, reportType]);

  async function handleCreate() {
    const recipients = recipientsInput
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      toast.error('Add at least one recipient email.');
      return;
    }
    setSaving(true);
    try {
      await createReportSchedule({
        companyId,
        reportType,
        frequency,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        recipients,
        createdBy: user?.uid ?? '',
        createdByName: user?.displayName ?? userProfile?.fullName ?? '',
        config,
      });
      toast.success('Report scheduled.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule report');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(schedule: ReportSchedule) {
    try {
      await setReportScheduleActive(schedule.id, !schedule.active);
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, active: !s.active } : s)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update schedule');
    }
  }

  async function handleDelete(scheduleId: string) {
    try {
      await deleteReportSchedule(scheduleId);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
  }

  function describeCadence(s: ReportSchedule): string {
    if (s.frequency === 'daily') return 'Daily at 04:00 UTC';
    if (s.frequency === 'weekly') return `Weekly on ${WEEKDAY_LABELS[s.dayOfWeek ?? 1]} at 04:00 UTC`;
    return `Monthly on day ${s.dayOfMonth ?? 1} at 04:00 UTC`;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#1E3A5F] bg-[#0F1E35] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[#1E3A5F] p-4">
          <div className="flex items-center gap-2 text-[#F0F4F8]">
            <CalendarClock className="h-5 w-5 text-[#00C2FF]" />
            <h3 className="font-[Sora] text-base font-bold">Schedule This Report</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8BA3BF] hover:bg-[#0A1628] hover:text-[#F0F4F8]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <label className="space-y-1 text-xs text-[#8BA3BF]">
              Frequency
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ReportScheduleFrequency)}
                className="min-h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            {frequency === 'weekly' && (
              <label className="space-y-1 text-xs text-[#8BA3BF]">
                Day of week
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="min-h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
                >
                  {WEEKDAY_LABELS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {frequency === 'monthly' && (
              <label className="space-y-1 text-xs text-[#8BA3BF]">
                Day of month
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="min-h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
                />
              </label>
            )}

            <label className="space-y-1 text-xs text-[#8BA3BF]">
              Recipients (comma-separated emails)
              <input
                value={recipientsInput}
                onChange={(e) => setRecipientsInput(e.target.value)}
                placeholder="you@company.com, other@company.com"
                className="min-h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleCreate}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-3 text-sm font-semibold text-white transition hover:bg-[#1D64F2] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create Schedule'}
          </button>

          <div className="space-y-2 border-t border-[#1E3A5F] pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#8BA3BF]">Active Schedules</h4>
            {loading ? (
              <p className="text-xs text-[#8BA3BF]">Loading…</p>
            ) : schedules.length === 0 ? (
              <p className="text-xs text-[#8BA3BF]">No schedules yet for this report.</p>
            ) : (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
                    <div>
                      <p className="text-sm text-[#F0F4F8]">{describeCadence(s)}</p>
                      <p className="text-xs text-[#8BA3BF]">{s.recipients.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(s)}
                        className={`min-h-8 rounded-md px-2 text-xs font-semibold ${s.active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#8BA3BF]/20 text-[#8BA3BF]'}`}
                      >
                        {s.active ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[#EF4444] hover:bg-[#EF4444]/10"
                        aria-label="Delete schedule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
