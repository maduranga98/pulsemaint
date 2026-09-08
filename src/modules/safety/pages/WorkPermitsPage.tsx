import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useWorkPermitCategories } from '@/hooks/useWorkPermitCategories';
import {
  WORK_PERMIT_COMPLETIONS,
  formatPermitDateTime,
  isWorkPermitOverdue,
  type WorkPermit,
  type WorkPermitCategory,
  type WorkPermitCompletion,
  type WorkPermitStatus,
} from '@/types/safety';
import NewWorkPermitModal from '../components/NewWorkPermitModal';

const STATUS_STYLE: Record<WorkPermitStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-300',
  active: 'bg-[#10B981]/15 text-[#10B981]',
  closed: 'bg-slate-500/15 text-slate-400',
  expired: 'bg-[#EF4444]/15 text-[#EF4444]',
};

const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';

type Filter = 'all' | WorkPermitCategory;
type LifecycleTab = 'current' | 'closed';

export default function WorkPermitsPage() {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const toast = useToast();
  const { permits, loading } = useWorkPermits(companyId);
  const { categories } = useWorkPermitCategories(companyId);
  const catLabel = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.value, c.label])) as Record<WorkPermitCategory, string>,
    [categories],
  );
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [lifecycleTab, setLifecycleTab] = useState<LifecycleTab>('current');
  const [signingOff, setSigningOff] = useState<WorkPermit | null>(null);
  const [extending, setExtending] = useState<WorkPermit | null>(null);
  const [extendValue, setExtendValue] = useState('');
  const [extendSaving, setExtendSaving] = useState(false);

  const role = profile?.role ?? '';
  // Closed work permits are only ever visible to admins — every other role
  // stops seeing a permit the moment it closes, including on the Closed tab.
  const effectiveLifecycleTab = role === 'admin' ? lifecycleTab : 'current';

  const filtered = useMemo(() => {
    let list = permits.filter((p) => (effectiveLifecycleTab === 'closed' ? p.status === 'closed' : p.status !== 'closed'));
    if (filter !== 'all') list = list.filter((p) => p.category === filter);
    return list;
  }, [permits, filter, effectiveLifecycleTab]);

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

  // Open the date/time picker for a permit. Seed it with the current validity
  // end, trimmed to the 'YYYY-MM-DDTHH:mm' shape a datetime-local input needs.
  function openExtend(p: WorkPermit) {
    const seed = (p.validTo || '').length === 10 ? `${p.validTo}T17:00` : (p.validTo || '').slice(0, 16);
    setExtendValue(seed);
    setExtending(p);
  }

  async function saveExtend() {
    if (!extending) return;
    if (!extendValue) {
      toast.error(t('common.workPermits.extendModal.errors.pickDateTime'));
      return;
    }
    if (extendValue <= extending.validFrom || extendValue <= (extending.validTo || '')) {
      toast.error(t('common.workPermits.extendModal.errors.endMustBeLater'));
      return;
    }
    setExtendSaving(true);
    try {
      await extendWorkPermit(extending.id, extendValue);
      toast.success(t('common.workPermits.extendModal.toasts.extended'));
      setExtending(null);
    } catch {
      toast.error(t('common.workPermits.extendModal.toasts.failed'));
    } finally {
      setExtendSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <FileCheck className="h-5 w-5 text-[#5B8DEF]" /> {t('common.workPermits.pageTitle')}
          </h1>
          <p className="mt-0.5 text-sm text-[#8BA3BF]">{t('common.workPermits.pageSubtitle')}</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> {t('common.workPermits.newPermit')}
        </button>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-8">
        {/* Current / Closed lifecycle tabs */}
        <div className="mb-4 flex gap-1 border-b border-[#1E3A5F]">
          {(['current', ...(role === 'admin' ? (['closed'] as LifecycleTab[]) : [])] as LifecycleTab[]).map((tab) => {
            const count = permits.filter((p) => (tab === 'closed' ? p.status === 'closed' : p.status !== 'closed')).length;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setLifecycleTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  effectiveLifecycleTab === tab
                    ? 'border-[#1A56DB] text-[#5B8DEF]'
                    : 'border-transparent text-[#8BA3BF] hover:text-white'
                }`}
              >
                {tab === 'current' ? t('common.workPermits.tabs.current') : t('common.workPermits.tabs.closed')} <span className="text-xs text-[#8BA3BF]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Category filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setFilter((f) => (f === c.value ? 'all' : c.value))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === c.value ? 'bg-[#1A56DB] text-white' : 'bg-[#0F1E35] text-[#8BA3BF] hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl border border-[#1E3A5F] bg-[#0F1E35]" />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-6">
            <EmptyState message={effectiveLifecycleTab === 'closed' ? t('common.workPermits.empty.closed') : t('common.workPermits.empty.current')} />
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
                        <span className="rounded-md bg-[#1A56DB]/15 px-2 py-0.5 text-xs font-semibold text-[#5B8DEF]">{catLabel[p.category] ?? p.category}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{t(`common.workPermits.statuses.${p.status}`)}</span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-xs font-medium text-[#EF4444]">
                            <AlertTriangle className="h-3 w-3" /> {t('common.workPermits.overdue')}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 font-semibold text-[#F0F4F8]">{p.title}</h3>
                      <p className="text-xs text-[#8BA3BF]">{p.location || t('common.workPermits.noLocation')} · {p.permitNumber}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[#8BA3BF]">{t('common.workPermits.validRange', { from: formatPermitDateTime(p.validFrom), to: formatPermitDateTime(p.validTo) })}</div>
                  {p.workOrderNumber && (
                    <div className="mt-1 text-xs text-[#8BA3BF]">
                      {p.woType
                        ? t('common.workPermits.workOrderLineWithType', { number: p.workOrderNumber, type: p.woType })
                        : t('common.workPermits.workOrderLine', { number: p.workOrderNumber })}
                    </div>
                  )}
                  {p.supervisorName && <div className="mt-1 text-xs text-[#8BA3BF]">{t('common.workPermits.supervisorLine', { name: p.supervisorName })}</div>}
                  {p.precautions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.precautions.map((pr) => (
                        <span key={pr} className="rounded bg-[#0A1628] px-2 py-0.5 text-[10px] text-[#8BA3BF]">{pr}</span>
                      ))}
                    </div>
                  )}
                  {p.status === 'closed' && p.completion && (
                    <div className="mt-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-xs">
                      <span className="font-semibold text-[#10B981]">{t(`common.workPermits.completions.${p.completion}`)}</span>
                      {p.signedOffByName && <span className="text-[#8BA3BF]"> · {t('common.workPermits.signedOffBy', { name: p.signedOffByName })}</span>}
                      {p.completionNote && <div className="mt-0.5 text-[#8BA3BF]">{p.completionNote}</div>}
                    </div>
                  )}
                  {p.status === 'active' && (
                    <div className="mt-3 flex flex-wrap gap-3 border-t border-[#1E3A5F] pt-3">
                      <button type="button" onClick={() => openExtend(p)} className="text-xs font-semibold text-[#5B8DEF] hover:underline">{t('common.workPermits.extendTime')}</button>
                      <button type="button" onClick={() => setSigningOff(p)} className="text-xs font-semibold text-[#10B981] hover:underline">{t('common.workPermits.finishAndSignOff')}</button>
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
      {extending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setExtending(null)}>
          <div className="w-full max-w-sm rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-5 text-[#F0F4F8]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold">{t('common.workPermits.extendModal.title')}</h3>
              <button type="button" onClick={() => setExtending(null)} className="text-[#8BA3BF] hover:text-white" aria-label={t('common.workPermits.close')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[#8BA3BF]">
              {extending.permitNumber} · {extending.title}
            </p>
            <p className="mt-2 text-xs text-[#8BA3BF]">
              {t('common.workPermits.extendModal.currentlyValidUntil', { date: formatPermitDateTime(extending.validTo) })}
            </p>
            <label className="mt-3 block text-xs font-medium text-[#8BA3BF]">{t('common.workPermits.extendModal.newValidUntil')}</label>
            <input
              type="datetime-local"
              value={extendValue}
              min={(extending.validFrom || '').slice(0, 16)}
              onChange={(e) => setExtendValue(e.target.value)}
              className={`${field} mt-1 [color-scheme:dark]`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtending(null)}
                className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-4 py-2 text-sm text-[#F0F4F8]"
              >
                {t('common.workPermits.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void saveExtend()}
                disabled={extendSaving}
                className="rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {extendSaving ? t('common.workPermits.extendModal.extending') : t('common.workPermits.extendModal.extend')}
              </button>
            </div>
          </div>
        </div>
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
  const { t } = useTranslation();
  const toast = useToast();
  const [completion, setCompletion] = useState<WorkPermitCompletion>('completed');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await signOffWorkPermit(permit.id, { completion, completionNote: note.trim(), signedOffBy, signedOffByName });
      toast.success(t('common.workPermits.signOffModal.toasts.signedOff'));
      onClose();
    } catch {
      toast.error(t('common.workPermits.signOffModal.toasts.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className=" text-lg font-bold text-[#F0F4F8]">{t('common.workPermits.signOffModal.title')}</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-white" aria-label={t('common.workPermits.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[#8BA3BF]">{permit.permitNumber} · {permit.title}</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#8BA3BF] mb-1">{t('common.workPermits.signOffModal.completionStatusLabel')}</label>
            <select value={completion} onChange={(e) => setCompletion(e.target.value as WorkPermitCompletion)} className={field}>
              {WORK_PERMIT_COMPLETIONS.map((c) => <option key={c.value} value={c.value}>{t(`common.workPermits.completions.${c.value}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8BA3BF] mb-1">{t('common.workPermits.signOffModal.noteLabel')}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={field} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#8BA3BF] hover:text-white">{t('common.workPermits.cancel')}</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? t('common.workPermits.signOffModal.saving') : t('common.workPermits.signOffModal.signOff')}
          </button>
        </div>
      </div>
    </div>
  );
}
