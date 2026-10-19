import { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { formatMoney, getCompanyCurrency } from '@/lib/currency';
import { annualDepreciation, bookValue, depreciationSoFar, replaceAdvice, workOrderCost } from '../../lib/machineAsset';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { subscribeOutsourcedMaintenance } from '../../services/machineOutsourced.service';
import type { Machine } from '../../types/machine';

const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

const ADVICE = {
  ok: null,
  watch: { key: 'adviceWatch', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  replace: { key: 'adviceReplace', cls: 'border-rose-200 bg-rose-50 text-rose-800' },
} as const;

const toMs = (t: { toDate?: () => Date; seconds?: number } | null | undefined): number | null =>
  t ? (t.toDate ? t.toDate().getTime() : t.seconds != null ? t.seconds * 1000 : null) : null;

/**
 * Purchase price, scrap value, current (straight-line) value and what outside maintenance has cost so far.
 * Shown to admins and plant managers only — see the firestore rules for the cost records it reads.
 */
export function MachineAssetCard({ machine, siteId }: { machine: Machine; siteId: string }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(machine.purchasePrice != null ? String(machine.purchasePrice) : '');
  const [scrapValue, setScrapValue] = useState(machine.scrapValue != null ? String(machine.scrapValue) : '');
  const [outsourcedTotal, setOutsourcedTotal] = useState(0);
  // Parts and contractor charges on this machine's finished work orders.
  const { workOrders } = useWorkOrders({ machineId: machine.id });
  const woTotal = useMemo(() => workOrders.reduce((s, wo) => s + workOrderCost(wo), 0), [workOrders]);
  const maintenanceTotal = outsourcedTotal + woTotal;

  useEffect(() => subscribeOutsourcedMaintenance(siteId, machine.id,
    (rows) => setOutsourcedTotal(rows.reduce((s, r) => s + r.totalCost, 0)), () => setOutsourcedTotal(0)), [siteId, machine.id]);

  const book = useMemo(() => bookValue({
    purchasePrice: machine.purchasePrice, scrapValue: machine.scrapValue,
    purchasedAtMs: toMs(machine.purchaseDate), lifespanYears: machine.expectedLifespanYears,
  }), [machine.purchasePrice, machine.scrapValue, machine.purchaseDate, machine.expectedLifespanYears]);
  const yearly = annualDepreciation({ purchasePrice: machine.purchasePrice, scrapValue: machine.scrapValue, lifespanYears: machine.expectedLifespanYears });
  const written = depreciationSoFar(machine.purchasePrice, book);
  const advice = ADVICE[replaceAdvice({ purchasePrice: machine.purchasePrice, maintenanceCost: maintenanceTotal, bookValue: book })];

  async function save() {
    const p = price.trim() === '' ? null : Number(price);
    const s = scrapValue.trim() === '' ? null : Number(scrapValue);
    if ((p != null && (!Number.isFinite(p) || p < 0)) || (s != null && (!Number.isFinite(s) || s < 0))) return toast.error(t('common.machines.asset.errAmounts'));
    if (p != null && s != null && s > p) return toast.error(t('common.machines.asset.errScrapOverPrice'));
    setSaving(true);
    try {
      await updateDoc(doc(db, 'machines', machine.id), { purchasePrice: p, scrapValue: s, updatedAt: serverTimestamp() });
      toast.success(t('common.machines.asset.saved'));
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message || t('common.machines.asset.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between"><dt className="text-gray-600">{label}</dt><dd className={strong ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}>{value}</dd></div>
  );
  const money = (v: number | null | undefined) => (v == null ? '—' : formatMoney(v));

  return (
    <div data-tour="asset-card" className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{t('common.machines.asset.title')}</h3>
        {!editing && machine.status !== 'scrapped' && (
          <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
            <Edit2 className="h-4 w-4" /> {t('common.machines.asset.edit')}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">{t('common.machines.asset.purchasePrice')} ({getCompanyCurrency()})</span>
              <input type="number" min={0} className={input} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">{t('common.machines.asset.scrapValue')} ({getCompanyCurrency()})</span>
              <input type="number" min={0} className={input} value={scrapValue} onChange={(e) => setScrapValue(e.target.value)} /></label>
          </div>
          <p className="text-xs text-gray-500">{t('common.machines.asset.depreciationHint')}</p>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{saving ? t('common.machines.asset.saving') : t('common.machines.asset.save')}</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{t('common.machines.asset.cancel')}</button>
          </div>
        </div>
      ) : (
        <>
          <dl className="grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
            {row(t('common.machines.asset.purchasePrice'), money(machine.purchasePrice))}
            {row(t('common.machines.asset.scrapValue'), money(machine.scrapValue))}
            {row(t('common.machines.asset.annualDepreciation'), yearly == null ? t('common.machines.asset.currentValueMissing') : t('common.machines.asset.perYear', { amount: money(yearly) }))}
            {row(t('common.machines.asset.accumulatedDepreciation'), written == null ? t('common.machines.asset.currentValueMissing') : `${money(written.amount)} (${written.percent}%)`)}
            {row(t('common.machines.asset.currentValue'), book == null ? t('common.machines.asset.currentValueMissing') : money(book))}
            {row(t('common.machines.asset.outsourcedJobs'), money(outsourcedTotal))}
            {row(t('common.machines.asset.workOrders'), money(woTotal))}
            {row(t('common.machines.asset.totalMaintenance'), money(maintenanceTotal), true)}
            {machine.purchasePrice != null && row(t('common.machines.asset.totalOwnership'), money(machine.purchasePrice + maintenanceTotal), true)}
            {machine.scrapRecord && row(t('common.machines.asset.scrapProceeds'), `${machine.scrapRecord.currency} ${machine.scrapRecord.proceeds.toLocaleString()}`)}
          </dl>
          {advice && <p className={`mt-4 rounded-lg border p-3 text-sm ${advice.cls}`}>{t(`common.machines.asset.${advice.key}`)}</p>}
        </>
      )}
    </div>
  );
}
