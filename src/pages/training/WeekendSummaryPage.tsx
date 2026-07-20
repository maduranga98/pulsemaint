import { useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useMyProgramme } from '@/hooks/traineeProgram/useMyProgramme';
import { useWeekendSummaries } from '@/hooks/traineeProgram/useWeekendSummaries';
import { submitWeekendSummary } from '@/services/traineeProgram.service';
import type { WeekendTaskEntry } from '@/types/traineeProgram';

function upcomingWeekEndingDate(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const diffToSaturday = (6 - day + 7) % 7;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + diffToSaturday);
  return saturday.toISOString().slice(0, 10);
}

function currentProgrammeMonth(startDate: { toDate?: () => Date } | null | undefined): number {
  if (!startDate?.toDate) return 1;
  const start = startDate.toDate();
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(1, months + 1);
}

function formatTs(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const REVIEW_LABEL: Record<string, string> = {
  pending: 'Pending Review',
  reviewed: 'Reviewed',
  needs_revision: 'Needs Revision',
};

export default function WeekendSummaryPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { programme, loading: programmeLoading } = useMyProgramme();
  const { summaries, loading: summariesLoading } = useWeekendSummaries(programme?.id ?? null);

  const month = currentProgrammeMonth(programme?.startDate);
  const monthPlan = programme?.months.find((m) => m.month === month);

  const [weekEndingDate, setWeekEndingDate] = useState(upcomingWeekEndingDate());
  const [summaryText, setSummaryText] = useState('');
  const [tasks, setTasks] = useState<WeekendTaskEntry[]>(
    () => monthPlan?.weekendTaskTemplate.map((label, i) => ({ id: `t${i}`, description: label, completed: false })) ?? [],
  );
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = programme && weekEndingDate && summaryText.trim().length > 0;

  const handleSubmit = async () => {
    if (!programme || !userProfile || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitWeekendSummary({
        companyId: userProfile.companyId,
        programmeId: programme.id,
        traineeId: userProfile.id,
        traineeName: userProfile.fullName,
        weekEndingDate,
        month,
        summaryText: summaryText.trim(),
        tasks,
        files,
        uploadedByName: userProfile.fullName,
      });
      toast.success('Weekend summary submitted.');
      setSummaryText('');
      setFiles([]);
      setTasks((prev) => prev.map((t) => ({ ...t, completed: false })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit summary');
    } finally {
      setSubmitting(false);
    }
  };

  const loading = programmeLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  if (!programme) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Weekend Work Summary</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          You need an active training programme before you can submit a weekend summary.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Weekend Work Summary</h1>
        <p className="mt-1 text-slate-600">Record your summary of work for the week and mark off this month's expected tasks.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Week Ending</label>
          <input
            type="date"
            value={weekEndingDate}
            onChange={(e) => setWeekEndingDate(e.target.value)}
            className="w-full sm:w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Summary of Work</label>
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            rows={5}
            placeholder="Describe what you worked on this week..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {tasks.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Month {month} Weekend Tasks
            </label>
            <div className="space-y-2">
              {tasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={(e) =>
                      setTasks((prev) => prev.map((p) => (p.id === t.id ? { ...p, completed: e.target.checked } : p)))
                    }
                    className="rounded border-slate-300"
                  />
                  {t.description}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Attachments</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
                  <span className="flex items-center gap-1 truncate"><Paperclip size={12} /> {f.name}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Summary'}
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Past Submissions</h2>
        {summariesLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : summaries.length === 0 ? (
          <p className="text-sm text-slate-500">No submissions yet.</p>
        ) : (
          <div className="space-y-2">
            {summaries.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">Week ending {s.weekEndingDate}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.reviewStatus === 'reviewed' ? 'bg-green-100 text-green-700'
                    : s.reviewStatus === 'needs_revision' ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {REVIEW_LABEL[s.reviewStatus]}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Submitted {formatTs(s.submittedAt)}</p>
                {s.reviewComments && (
                  <p className="text-xs text-slate-600 mt-2 italic">"{s.reviewComments}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
