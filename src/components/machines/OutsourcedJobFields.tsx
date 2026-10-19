import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatMoney, getCompanyCurrency } from '@/lib/currency';
import { outsourcedJobTotals, type OutsourcedPart } from '../../lib/machineAsset';
import { OUTSOURCED_JOB_TYPES, type OutsourcedJobType } from '../../types/outsourcedMaintenance';

const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none';

/** What the user has typed for an outsourced job: dates are "yyyy-mm-dd" strings, money is text until saved. */
export interface OutsourcedJobDraft {
  jobType: OutsourcedJobType;
  description: string;
  startedAt: string;
  completedAt: string;
  parts: OutsourcedPart[];
  labour: string;
  invoiceNumber: string;
  files: File[];
  notes: string;
}

export const emptyPart = (): OutsourcedPart => ({ name: '', partNumber: '', kind: 'replaced', quantity: 1, unitPrice: 0 });

export function emptyJobDraft(): OutsourcedJobDraft {
  const today = new Date().toISOString().slice(0, 10);
  return { jobType: 'repair', description: '', startedAt: today, completedAt: today, parts: [], labour: '', invoiceNumber: '', files: [], notes: '' };
}

/** True when anything cost-related was entered — an untouched section saves nothing. */
export function isJobDraftFilled(d: OutsourcedJobDraft): boolean {
  return d.parts.some((p) => p.name.trim()) || Number(d.labour) > 0 || d.files.length > 0 || d.invoiceNumber.trim() !== '';
}

/** Locale key (under common.machines.asset.outsourced) of the first problem, or null when the draft is fine. */
export function jobDraftError(d: OutsourcedJobDraft): 'errStart' | 'errDates' | 'errParts' | 'errLabour' | null {
  if (!d.startedAt) return 'errStart';
  if (d.completedAt && new Date(d.completedAt) < new Date(d.startedAt)) return 'errDates';
  if (d.parts.filter((p) => p.name.trim()).some((p) => !(p.quantity > 0) || p.unitPrice < 0)) return 'errParts';
  if (Number(d.labour) < 0) return 'errLabour';
  return null;
}

export const draftDayMs = (d: string) => new Date(`${d}T12:00:00`).getTime();

/** The form fields for one outsourced job: work done, parts replaced/added with prices, labour, total and invoices. */
export function OutsourcedJobFields({ value, onChange }: { value: OutsourcedJobDraft; onChange: (v: OutsourcedJobDraft) => void }) {
  const { t } = useTranslation();
  const tt = (k: string, o?: Record<string, unknown>) => t(`common.machines.asset.outsourced.${k}` as never, o as never) as unknown as string;
  const currency = getCompanyCurrency();
  const set = <K extends keyof OutsourcedJobDraft>(k: K, v: OutsourcedJobDraft[K]) => onChange({ ...value, [k]: v });
  const setPart = (i: number, patch: Partial<OutsourcedPart>) => set('parts', value.parts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const totals = outsourcedJobTotals(value.parts, Number(value.labour) || 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">{tt('typeOfWork')}</span>
          <select className={input} value={value.jobType} onChange={(e) => set('jobType', e.target.value as OutsourcedJobType)}>
            {OUTSOURCED_JOB_TYPES.map((jt) => <option key={jt.value} value={jt.value}>{tt(`jobTypes.${jt.value}`)}</option>)}
          </select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">{tt('started')}</span>
            <input type="date" className={input} value={value.startedAt} onChange={(e) => set('startedAt', e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">{tt('finished')}</span>
            <input type="date" className={input} value={value.completedAt} onChange={(e) => set('completedAt', e.target.value)} /></label>
        </div>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium text-gray-700">{tt('whatWasDone')}</span>
          <textarea className={input} rows={2} value={value.description} onChange={(e) => set('description', e.target.value)} placeholder={tt('whatPlaceholder')} /></label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{tt('partsHeading')}</span>
          <button type="button" onClick={() => set('parts', [...value.parts, emptyPart()])} className="text-sm text-blue-600 hover:text-blue-800">+ {tt('addPart')}</button>
        </div>
        {value.parts.length === 0 && <p className="text-xs text-gray-500">{tt('noParts')}</p>}
        <div className="space-y-2">
          {value.parts.map((p, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-200 p-2">
              <label className="col-span-12 text-xs sm:col-span-4">{tt('part')}<input className={input} value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} placeholder={tt('partPlaceholder')} /></label>
              <label className="col-span-6 text-xs sm:col-span-2">{tt('partNo')}<input className={input} value={p.partNumber ?? ''} onChange={(e) => setPart(i, { partNumber: e.target.value })} /></label>
              <label className="col-span-6 text-xs sm:col-span-2">{tt('fittedAs')}
                <select className={input} value={p.kind} onChange={(e) => setPart(i, { kind: e.target.value as OutsourcedPart['kind'] })}>
                  <option value="replaced">{tt('replaced')}</option><option value="added">{tt('added')}</option>
                </select></label>
              <label className="col-span-3 text-xs sm:col-span-1">{tt('qty')}<input type="number" min={1} className={input} value={p.quantity} onChange={(e) => setPart(i, { quantity: Number(e.target.value) })} /></label>
              <label className="col-span-5 text-xs sm:col-span-2">{tt('unitPrice')}<input type="number" min={0} className={input} value={p.unitPrice || ''} onChange={(e) => setPart(i, { unitPrice: Number(e.target.value) })} /></label>
              <button type="button" aria-label={tt('removePart')} onClick={() => set('parts', value.parts.filter((_, j) => j !== i))} className="col-span-4 pb-2 text-gray-400 hover:text-red-600 sm:col-span-1"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">{tt('labourLabel', { currency })}</span>
          <input type="number" min={0} className={input} value={value.labour} onChange={(e) => set('labour', e.target.value)} placeholder="0" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">{tt('invoiceNumber')}</span>
          <input className={input} value={value.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} /></label>
      </div>
      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <div className="flex justify-between text-gray-600"><span>{tt('totalParts')}</span><span>{formatMoney(totals.partsTotal)}</span></div>
        <div className="flex justify-between text-gray-600"><span>{tt('totalLabour')}</span><span>{formatMoney(Number(value.labour) || 0)}</span></div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900"><span>{tt('totalCost')}</span><span>{formatMoney(totals.total)}</span></div>
      </div>

      <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{tt('invoicesLabel')}</span>
        <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => set('files', Array.from(e.target.files ?? []))} className="block w-full text-sm text-gray-600" />
        {value.files.length > 0 && <span className="mt-1 block text-xs text-gray-500">{tt('filesSelected', { count: value.files.length })}</span>}</label>
      <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{tt('notes')}</span>
        <input className={input} value={value.notes} onChange={(e) => set('notes', e.target.value)} placeholder={tt('notesPlaceholder')} /></label>
    </div>
  );
}
