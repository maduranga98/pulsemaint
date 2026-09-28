import { useEffect, useMemo, useState } from 'react';
import { X, Share2, Wrench, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useRecordPlantMatcher } from '@/hooks/useRecordPlantMatcher';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/recordAccess';
import { shareRecordsWithRequester, type SharedRecordInput } from '@/services/recordAccessGrants.service';
import { notifyUsers } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import type { Breakdown } from '@/types/breakdown';
import type { WorkOrder } from '@/types/workOrder';
import type { StaffRequest } from '@/types/staffRequest';
import { field, fmtTs, labelCls } from '../requestUi';

type Tab = 'work_order' | 'breakdown';

const HOUR = 60 * 60 * 1000;
const PRESETS: { key: string; ms: number }[] = [
  { key: 'h24', ms: 24 * HOUR },
  { key: 'd3', ms: 3 * 24 * HOUR },
  { key: 'd7', ms: 7 * 24 * HOUR },
  { key: 'd30', ms: 30 * 24 * HOUR },
];
const MAX_SHOWN = 100;

function millis(ts: { toMillis?: () => number } | null | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

/**
 * Plant manager / admin answering a record_access request: pick the work
 * orders and/or breakdowns to share, set until when the requester may view
 * them, and send.
 */
export default function GrantRecordsModal({ request: r, onClose }: { request: StaffRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const profile = useAuthStore((s) => s.userProfile);
  const siteId = profile?.siteIds?.[0] || profile?.companyId;
  const inScopedPlant = useRecordPlantMatcher();

  const [tab, setTab] = useState<Tab>(r.referenceType ?? 'work_order');
  const [search, setSearch] = useState(r.reference ?? '');
  const [selected, setSelected] = useState<Map<string, SharedRecordInput>>(new Map());
  const [expiry, setExpiry] = useState(() => toDateTimeLocalValue(Date.now() + 7 * 24 * HOUR));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { workOrders, loading: woLoading } = useWorkOrders();

  const [allBreakdowns, setAllBreakdowns] = useState<Breakdown[]>([]);
  const [bdLoading, setBdLoading] = useState(true);
  useEffect(() => {
    if (!siteId) return;
    setBdLoading(true);
    return onSnapshot(
      query(collection(db, 'breakdown_tickets'), where('siteId', '==', siteId), orderBy('reportedAt', 'desc')),
      (snap) => {
        setAllBreakdowns(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Breakdown));
        setBdLoading(false);
      },
      (err) => {
        console.error(err);
        setBdLoading(false);
      },
    );
  }, [siteId]);
  const breakdowns = useMemo(() => allBreakdowns.filter((b) => inScopedPlant(b)), [allBreakdowns, inScopedPlant]);

  // Preselect the record the requester picked, once it has loaded.
  const [preselected, setPreselected] = useState(false);
  useEffect(() => {
    if (preselected || !r.referenceId || !r.referenceType) return;
    if (r.referenceType === 'work_order') {
      if (woLoading) return;
      const w = workOrders.find((x) => x.id === r.referenceId);
      if (w) setSelected((prev) => new Map(prev).set(`work_order:${w.id}`, woInput(w)));
    } else {
      if (bdLoading) return;
      const b = allBreakdowns.find((x) => x.id === r.referenceId);
      if (b) setSelected((prev) => new Map(prev).set(`breakdown:${b.id}`, bdInput(b)));
    }
    setPreselected(true);
  }, [preselected, r.referenceId, r.referenceType, woLoading, bdLoading, workOrders, allBreakdowns]);

  const term = search.trim().toLowerCase();
  const woRows = useMemo(
    () =>
      workOrders
        .filter((w) => !term || [w.woNumber, w.machineName, w.description, w.machineDepartment].some((v) => (v ?? '').toLowerCase().includes(term)))
        .sort((a, b) => millis(b.createdAt) - millis(a.createdAt)),
    [workOrders, term],
  );
  const bdRows = useMemo(
    () =>
      breakdowns.filter(
        (b) => !term || [b.ticketNumber, b.machineName, b.description, b.machineDepartment].some((v) => (v ?? '').toLowerCase().includes(term)),
      ),
    [breakdowns, term],
  );

  function toggle(key: string, input: SharedRecordInput) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, input);
      return next;
    });
  }

  const woInput = (w: WorkOrder): SharedRecordInput => ({
    recordType: 'work_order',
    recordId: w.id,
    recordNumber: w.woNumber,
    machineName: w.machineName ?? '',
    plantId: w.machinePlantId ?? null,
    data: w as unknown as Record<string, unknown>,
  });
  const bdInput = (b: Breakdown): SharedRecordInput => ({
    recordType: 'breakdown',
    recordId: b.id,
    recordNumber: b.ticketNumber,
    machineName: b.machineName ?? '',
    plantId: b.machinePlantId ?? null,
    data: b as unknown as Record<string, unknown>,
  });

  async function submit() {
    if (!profile?.companyId) return;
    if (selected.size === 0) {
      toast.error(t('common.staffRequests.records.grant.errors.none'));
      return;
    }
    const expiresMs = fromDateTimeLocalValue(expiry);
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now() + 60_000) {
      toast.error(t('common.staffRequests.records.grant.errors.expiry'));
      return;
    }
    const records = [...selected.values()];
    const expiresAt = new Date(expiresMs);
    const list = records.map((x) => x.recordNumber).join(', ');
    const until = expiresAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setSaving(true);
    try {
      await shareRecordsWithRequester({
        request: r,
        records,
        expiresAt,
        note: note.trim() || null,
        grantor: { id: profile.id, name: profile.fullName ?? '', role: profile.role },
        replyMessage: [t('common.staffRequests.records.grant.reply', { list, date: until }), note.trim()].filter(Boolean).join('\n\n'),
      });
      void notifyUsers(profile.companyId, [r.requesterId], {
        type: 'request',
        message: t('common.staffRequests.records.grant.notification', { name: profile.fullName ?? '', list, date: until }),
        linkTo: '/app/requests',
        actorName: profile.fullName ?? '',
        actorRole: profile.role as UserRole,
        actorUserId: profile.id,
        plantId: r.plantId,
        department: null,
      });
      toast.success(t('common.staffRequests.records.grant.done', { count: records.length }));
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('common.staffRequests.records.grant.failed'));
    } finally {
      setSaving(false);
    }
  }

  const loading = tab === 'work_order' ? woLoading : bdLoading;
  const rows = tab === 'work_order' ? woRows : bdRows;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#1E3A5F] bg-[#0F1E35] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#1E3A5F] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#F0F4F8]">{t('common.staffRequests.records.grant.title')}</h2>
            <p className="truncate text-xs text-[#8BA3BF]">
              {t('common.staffRequests.records.grant.subtitle', { name: r.requesterName })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-[#F0F4F8]" aria-label={t('common.staffRequests.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {r.reference && (
            <p className="text-xs text-[#93C5FD]">{t('common.staffRequests.card.reference', { reference: r.reference })}</p>
          )}

          <div className="flex gap-2">
            {(['work_order', 'breakdown'] as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  tab === k ? 'bg-[#1A56DB] text-white' : 'bg-[#142849] text-[#B8C7DB] hover:bg-[#1E3A5F]'
                }`}
              >
                {k === 'work_order' ? <Wrench className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {k === 'work_order' ? t('common.staffRequests.records.workOrders') : t('common.staffRequests.records.breakdowns')}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.staffRequests.records.grant.search')}
            className={field}
          />

          <div className="max-h-72 overflow-y-auto rounded-lg border border-[#1E3A5F]">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1A56DB] border-t-transparent" />
              </div>
            ) : rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#8BA3BF]">{t('common.staffRequests.records.grant.noMatches')}</p>
            ) : (
              <ul className="divide-y divide-[#1E3A5F]">
                {tab === 'work_order'
                  ? woRows.slice(0, MAX_SHOWN).map((w) => {
                      const key = `work_order:${w.id}`;
                      return (
                        <li key={key}>
                          <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-[#142849]">
                            <input type="checkbox" className="mt-1" checked={selected.has(key)} onChange={() => toggle(key, woInput(w))} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm text-[#F0F4F8]">
                                <span className="font-medium">{w.woNumber}</span> · {w.machineName}
                              </div>
                              <div className="truncate text-xs text-[#8BA3BF]">
                                {w.status.replace(/_/g, ' ')} · {fmtTs(w.createdAt)} · {w.description}
                              </div>
                            </div>
                          </label>
                        </li>
                      );
                    })
                  : bdRows.slice(0, MAX_SHOWN).map((b) => {
                      const key = `breakdown:${b.id}`;
                      return (
                        <li key={key}>
                          <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-[#142849]">
                            <input type="checkbox" className="mt-1" checked={selected.has(key)} onChange={() => toggle(key, bdInput(b))} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm text-[#F0F4F8]">
                                <span className="font-medium">{b.ticketNumber}</span> · {b.machineName}
                              </div>
                              <div className="truncate text-xs text-[#8BA3BF]">
                                {b.status.replace(/_/g, ' ')} · {fmtTs(b.reportedAt)} · {b.description}
                              </div>
                            </div>
                          </label>
                        </li>
                      );
                    })}
              </ul>
            )}
          </div>
          {rows.length > MAX_SHOWN && (
            <p className="text-xs text-[#8BA3BF]">{t('common.staffRequests.records.grant.refine', { count: MAX_SHOWN })}</p>
          )}

          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...selected.entries()].map(([key, v]) => (
                <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-[#1A56DB]/20 px-2.5 py-1 text-xs text-[#93C5FD]">
                  {v.recordNumber}
                  <button
                    type="button"
                    onClick={() => toggle(key, v)}
                    aria-label={t('common.staffRequests.attachments.remove', { name: v.recordNumber })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div>
            <label className={labelCls}>{t('common.staffRequests.records.grant.until')}</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setExpiry(toDateTimeLocalValue(Date.now() + p.ms))}
                  className="rounded-full bg-[#142849] px-3 py-1 text-xs font-medium text-[#B8C7DB] hover:bg-[#1E3A5F]"
                >
                  {t(`common.staffRequests.records.grant.presets.${p.key}`)}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={expiry}
              min={toDateTimeLocalValue(Date.now())}
              onChange={(e) => setExpiry(e.target.value)}
              className={`${field} sm:max-w-xs`}
            />
            <p className="mt-1 text-xs text-[#8BA3BF]">{t('common.staffRequests.records.grant.untilHint')}</p>
          </div>

          <div>
            <label className={labelCls}>{t('common.staffRequests.records.grant.note')}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#1E3A5F] px-5 py-3">
          <span className="text-xs text-[#8BA3BF]">{t('common.staffRequests.records.grant.selected', { count: selected.size })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-medium text-[#B8C7DB] hover:border-[#2E5A8F]"
            >
              {t('common.staffRequests.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              {saving ? t('common.staffRequests.sending') : t('common.staffRequests.records.grant.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
