import { useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { getCompanyCurrency } from '@/lib/currency';
import { SCRAP_REASONS, type ScrapReason } from '../../lib/machineAsset';
import type { Machine } from '../../types/machine';

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none';

/** Records that a machine was scrapped (or sold for scrap). The machine and its history stay on record. */
export function ScrapMachineDialog({ machine, userName, userId, companyId, onClose }: {
  machine: Machine; userName: string; userId: string; companyId: string; onClose: () => void;
}) {
  const { t } = useTranslation();
  const currency = getCompanyCurrency();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<ScrapReason>('broken');
  const [note, setNote] = useState('');
  const [proceeds, setProceeds] = useState('');
  const [approvedBy, setApprovedBy] = useState(userName);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!date) return toast.error(t('common.machines.asset.scrap.errDate'));
    if (!approvedBy.trim()) return toast.error(t('common.machines.asset.scrap.errApprover'));
    const amount = proceeds.trim() === '' ? 0 : Number(proceeds);
    if (!Number.isFinite(amount) || amount < 0) return toast.error(t('common.machines.asset.scrap.errAmount'));
    setSaving(true);
    try {
      await updateDoc(doc(db, 'machines', machine.id), {
        status: 'scrapped',
        scrapRecord: {
          scrappedAt: Timestamp.fromDate(new Date(`${date}T12:00:00`)),
          reason, note: note.trim(), proceeds: amount, currency,
          approvedBy: approvedBy.trim(), recordedBy: userId,
        },
        updatedAt: serverTimestamp(),
      });
      // A scrapped machine has nothing left to service: pause its active PM schedules (best effort).
      let paused = 0;
      try {
        const snap = await getDocs(query(collection(db, 'pm_schedules'),
          where('companyId', '==', companyId), where('machineId', '==', machine.id), where('status', '==', 'active')));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.update(d.ref, { status: 'paused', updatedAt: serverTimestamp() }));
        if (!snap.empty) await batch.commit();
        paused = snap.size;
      } catch { /* the machine is scrapped either way; schedules can be paused by hand */ }
      toast.success(`${t('common.machines.asset.scrap.done', { name: machine.name })}${paused ? t('common.machines.asset.scrap.pmPaused', { count: paused }) : ''}`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || t('common.machines.asset.scrap.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('common.machines.asset.scrap.title', { name: machine.name })}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('common.machines.asset.scrap.intro')}</p>
        </div>
        <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{t('common.machines.asset.scrap.date')}</span>
          <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{t('common.machines.asset.scrap.reason')}</span>
          <select className={field} value={reason} onChange={(e) => setReason(e.target.value as ScrapReason)}>
            {SCRAP_REASONS.map((r) => <option key={r} value={r}>{t(`common.machines.asset.scrap.reasons.${r}`)}</option>)}
          </select></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{t('common.machines.asset.scrap.details')}</span>
          <textarea className={field} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('common.machines.asset.scrap.detailsPlaceholder')} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{t('common.machines.asset.scrap.amount', { currency })}</span>
            <input type="number" min={0} className={field} value={proceeds} onChange={(e) => setProceeds(e.target.value)} placeholder="0" /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{t('common.machines.asset.scrap.approvedBy')}</span>
            <input className={field} value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} /></label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{t('common.machines.asset.cancel')}</button>
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
            {saving ? t('common.machines.asset.saving') : t('common.machines.asset.scrap.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
