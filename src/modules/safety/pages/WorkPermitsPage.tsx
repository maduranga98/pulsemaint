import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, FileCheck, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { useWorkPermits } from '@/hooks/safety/useSafety';
import {
  extendWorkPermit,
  markWorkPermitOverdueNotified,
  signOffWorkPermit,
} from '@/services/safety.service';
import { createNotification } from '@/services/notifications.service';
import {
  WORK_PERMIT_CATEGORIES,
  WORK_PERMIT_COMPLETIONS,
  isWorkPermitOverdue,
  type WorkPermit,
  type WorkPermitCategory,
  type WorkPermitCompletion,
  type WorkPermitStatus,
} from '@/types/safety';
import NewWorkPermitModal from '../components/NewWorkPermitModal';

const CAT_LABEL = Object.fromEntries(WORK_PERMIT_CATEGORIES.map((c) => [c.value, c.label])) as Record<WorkPermitCategory, string>;
const COMPLETION_LABEL = Object.fromEntries(WORK_PERMIT_COMPLETIONS.map((c) => [c.value, c.label]));

const STATUS_STYLE: Record<WorkPermitStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-300',
  active: 'bg-[#10B981]/15 text-[#10B981]',
  closed: 'bg-slate-500/15 text-slate-400',
  expired: 'bg-[#EF4444]/15 text-[#EF4444]',
};

const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';

type Filter = 'all' | WorkPermitCategory;

export default function WorkPermitsPage() {
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const toast = useToast();
  const { permits, loading } = useWorkPermits(companyId);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [signingOff, setSigningOff] = useState<WorkPermit | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? permits : permits.filter((p) => p.category === filter)),
    [permits, filter],
  );

  // Notify the permit's creator once, when it runs past its validity window.
  const notified = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!companyId) return;
    permits.forEach((p) => {
      if (!isWorkPermitOverdue(p) || p.overdueNotifiedAt || notified.current.has(p.id)) return;
      if (!p.requestedBy) return;
      notified.current.add(p.id);
      void createNotification({
        companyId,
        type: 'work_order',
        severity: 'high',
        message: `Work permit ${p.permitNumber} ("${p.title}") is overdue — extend it or finish and sign it off.`,
        recipientUserIds: [p.requestedBy],
        linkTo: '/app/safety/permits',
      }).then(() => markWorkPermitOverdueNotified(p.id).catch(() => {}));
    });
  }, [permits, companyId]);

  async function extend(p: WorkPermit) {
    const next = window.prompt('Extend permit until (YYYY-MM-DD):', p.validTo);
    if (!next) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next < p.validFrom) {
      toast.error('Enter a valid date on or after the start date.');
      return;
    }
    try {
      await extendWorkPermit(p.id, next);
      toast.success('Permit extended.');
    } catch {
      toast.error('Failed to extend permit.');
    }
  }

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 font-[Sora] text-xl font-bold">
            <FileCheck className="h-5 w-5 text-[#5B8DEF]" /> Work Permits
          </h1>
          <p className="mt-0.5 text-sm text-[#8BA3BF]">Permit-to-Work: issue, track, extend, and sign off safety permits.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> New Permit
        </button>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-8">
        {/* Category filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(['all', ...WORK_PERMIT_CATEGORIES.map((c) => c.value)] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f ? 'bg-[#1A56DB] text-white' : 'bg-[#0F1E35] text-[#8BA3BF] hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : CAT_LABEL[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl border border-[#1E3A5F] bg-[#0F1E35]" />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-6">
            <EmptyState message="No permits in this category" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((p) => {
              const overdue = isWorkPermitOverdue(p);
              return (
                <div key={p.id} className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[#1A56DB]/15 px-2 py-0.5 text-xs font-semibold text-[#5B8DEF]">{CAT_LABEL[p.category]}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-xs font-medium text-[#EF4444]">
                            <AlertTriangle className="h-3 w-3" /> Overdue
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 font-semibold text-[#F0F4F8]">{p.title}</h3>
                      <p className="text-xs text-[#8BA3BF]">{p.location || 'No location'} · {p.permitNumber}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[#8BA3BF]">Valid {p.validFrom} → {p.validTo}</div>
                  {p.workOrderNumber && (
                    <div className="mt-1 text-xs text-[#8BA3BF]">WO: {p.workOrderNumber}{p.woType ? ` (${p.woType})` : ''}</div>
                  )}
                  {p.supervisorName && <div className="mt-1 text-xs text-[#8BA3BF]">Supervisor: {p.supervisorName}</div>}
                  {p.precautions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.precautions.map((pr) => (
                        <span key={pr} className="rounded bg-[#0A1628] px-2 py-0.5 text-[10px] text-[#8BA3BF]">{pr}</span>
                      ))}
                    </div>
                  )}
                  {p.status === 'closed' && p.completion && (
                    <div className="mt-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-xs">
                      <span className="font-semibold text-[#10B981]">{COMPLETION_LABEL[p.completion]}</span>
                      {p.signedOffByName && <span className="text-[#8BA3BF]"> · signed off by {p.signedOffByName}</span>}
                      {p.completionNote && <div className="mt-0.5 text-[#8BA3BF]">{p.completionNote}</div>}
                    </div>
                  )}
                  {p.status === 'active' && (
                    <div className="mt-3 flex flex-wrap gap-3 border-t border-[#1E3A5F] pt-3">
                      <button type="button" onClick={() => void extend(p)} className="text-xs font-semibold text-[#5B8DEF] hover:underline">Extend time</button>
                      <button type="button" onClick={() => setSigningOff(p)} className="text-xs font-semibold text-[#10B981] hover:underline">Finish &amp; sign off</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creating && <NewWorkPermitModal onClose={() => setCreating(false)} />}
      {signingOff && (
        <SignOffModal
          permit={signingOff}
          onClose={() => setSigningOff(null)}
          signedOffBy={profile?.id ?? ''}
          signedOffByName={profile?.fullName ?? ''}
        />
      )}
    </div>
  );
}

function SignOffModal({
  permit,
  onClose,
  signedOffBy,
  signedOffByName,
}: {
  permit: WorkPermit;
  onClose: () => void;
  signedOffBy: string;
  signedOffByName: string;
}) {
  const toast = useToast();
  const [completion, setCompletion] = useState<WorkPermitCompletion>('completed');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await signOffWorkPermit(permit.id, { completion, completionNote: note.trim(), signedOffBy, signedOffByName });
      toast.success('Permit signed off.');
      onClose();
    } catch {
      toast.error('Failed to sign off permit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-[Sora] text-lg font-bold text-[#F0F4F8]">Sign off permit</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[#8BA3BF]">{permit.permitNumber} · {permit.title}</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#8BA3BF] mb-1">Completion status</label>
            <select value={completion} onChange={(e) => setCompletion(e.target.value as WorkPermitCompletion)} className={field}>
              {WORK_PERMIT_COMPLETIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8BA3BF] mb-1">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={field} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#8BA3BF] hover:text-white">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Sign off'}
          </button>
        </div>
      </div>
    </div>
  );
}
