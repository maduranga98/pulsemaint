import { useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useMyProgramme } from '@/hooks/traineeProgram/useMyProgramme';
import { useMyAssignments } from '@/hooks/training/useMyAssignments';
import { useWeekendSummaries } from '@/hooks/traineeProgram/useWeekendSummaries';
import { submitWeekendSummary } from '@/services/traineeProgram.service';

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTs(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const REVIEW_LABEL: Record<string, string> = {
  pending: 'Pending Review',
  reviewed: 'Reviewed',
  needs_revision: 'Needs Revision',
};

/**
 * Where a trainee writes up the knowledge they gathered during the first module
 * of their training programme, optionally attaching supporting files. This
 * replaces the earlier weekend-summary workflow; it is backed by the same
 * `weekendSummaries` collection (summary text + attachments), reused as the
 * knowledge note store.
 */
export default function KnowledgeWriteupPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { programme, loading: programmeLoading } = useMyProgramme();
  const { assignments } = useMyAssignments();
  const { summaries, loading: summariesLoading } = useWeekendSummaries(programme?.id ?? null);

  const [summaryText, setSummaryText] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Every module in the programme, so the write-up can be tagged to any of them
  // (not just the first). Falls back to the plan's module ids when an
  // assignment record hasn't been created yet.
  const programmeModules = (programme?.months ?? []).flatMap((m) =>
    m.moduleIds.map((id) => ({
      id,
      name: assignments.find((a) => a.moduleId === id)?.moduleName ?? id,
    })),
  );

  const canSubmit = !!programme && summaryText.trim().length > 0;

  const handleSubmit = async () => {
    if (!programme || !userProfile || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitWeekendSummary({
        companyId: userProfile.companyId,
        programmeId: programme.id,
        traineeId: userProfile.id,
        traineeName: userProfile.fullName,
        weekEndingDate: todayYmd(),
        month: 1,
        moduleId: moduleId || null,
        moduleName: programmeModules.find((m) => m.id === moduleId)?.name ?? null,
        summaryText: summaryText.trim(),
        tasks: [],
        files,
        uploadedByName: userProfile.fullName,
      });
      toast.success('Knowledge write-up submitted.');
      setSummaryText('');
      setModuleId('');
      setFiles([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit write-up');
    } finally {
      setSubmitting(false);
    }
  };

  if (programmeLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  if (!programme) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">First Module Knowledge Write-up</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          You need an active training programme before you can submit a knowledge write-up.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Module Knowledge Write-up</h1>
        <p className="mt-1 text-slate-600">
          Write up the knowledge you gathered from a module in your programme. Attachments are optional.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        {programmeModules.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Module</label>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a module…</option>
              {programmeModules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">What you learned</label>
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            rows={7}
            placeholder="Summarise the knowledge you gathered during the first module..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Attachments (optional)</label>
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
          {submitting ? 'Submitting…' : 'Submit Write-up'}
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
                  <span className="text-sm font-medium text-slate-800">{s.moduleName || 'Knowledge write-up'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.reviewStatus === 'reviewed' ? 'bg-green-100 text-green-700'
                    : s.reviewStatus === 'needs_revision' ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {REVIEW_LABEL[s.reviewStatus]}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{s.summaryText}</p>
                <p className="text-xs text-slate-500 mt-1">Submitted {formatTs(s.submittedAt)}</p>
                {s.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.attachments.map((att) => (
                      <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                        {att.name}
                      </a>
                    ))}
                  </div>
                )}
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
