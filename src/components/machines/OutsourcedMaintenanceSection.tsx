import { useEffect, useState } from 'react';
import { Paperclip, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { useContractors } from '../../hooks/contractors/useContractors';
import { formatMoney, getCompanyCurrency } from '@/lib/currency';
import { outsourcedJobTotals, partLineTotal, type OutsourcedPart } from '../../lib/machineAsset';
import {
  createOutsourcedMaintenance, deleteOutsourcedMaintenance, subscribeOutsourcedMaintenance,
} from '../../services/machineOutsourced.service';
import { OUTSOURCED_JOB_TYPES, type OutsourcedJobType, type OutsourcedMaintenance } from '../../types/outsourcedMaintenance';

const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const dayMs = (d: string) => new Date(`${d}T12:00:00`).getTime();
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const emptyPart = (): OutsourcedPart => ({ name: '', partNumber: '', kind: 'replaced', quantity: 1, unitPrice: 0 });

/** Maintenance done by outside contractors on this machine: parts fitted, costs and invoices. */
export function OutsourcedMaintenanceSection({ machineId, siteId }: { machineId: string; siteId: string }) {
  const [rows, setRows] = useState<OutsourcedMaintenance[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => subscribeOutsourcedMaintenance(siteId, machineId, setRows, (e) => setError(e.message)), [siteId, machineId]);

  const grand = rows.reduce((s, r) => s + r.totalCost, 0);

  async function remove(r: OutsourcedMaintenance) {
    if (!window.confirm(`Delete this ${r.contractorName} job and its invoices? This cannot be undone.`)) return;
    try {
      await deleteOutsourcedMaintenance(r);
    } catch (e) {
      toast.error((e as Error).message || 'Could not delete.');
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">Outsourced maintenance</h3>
          <p className="text-xs text-gray-500">Work done by outside companies — with parts fitted, cost and invoices.{rows.length > 0 && ` Total so far: ${formatMoney(grand)}.`}</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add outsourced job
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {rows.length === 0 && !error && <p className="text-sm text-gray-500">No outsourced jobs recorded for this machine yet.</p>}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{r.contractorName} <span className="font-normal text-gray-500">· {OUTSOURCED_JOB_TYPES.find((t) => t.value === r.jobType)?.label ?? r.jobType}</span></p>
                <p className="text-xs text-gray-500">{fmtDay(r.startedAt)}{r.completedAt ? ` – ${fmtDay(r.completedAt)}` : ''}{r.invoiceNumber && ` · Invoice ${r.invoiceNumber}`}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-gray-900">{formatMoney(r.totalCost, { currency: r.currency || undefined })}</span>
                <button type="button" title="Delete" aria-label="Delete job" onClick={() => void remove(r)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {r.description && <p className="mt-2 text-gray-700">{r.description}</p>}
            {r.parts.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <thead><tr className="text-left text-gray-500"><th className="py-1">Part</th><th>Fitted as</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {r.parts.map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1">{p.name}{p.partNumber && <span className="text-gray-400"> · {p.partNumber}</span>}</td>
                      <td>{p.kind === 'added' ? 'Added' : 'Replaced'}</td>
                      <td className="text-right">{p.quantity}</td>
                      <td className="text-right">{formatMoney(p.unitPrice, { currency: r.currency || undefined })}</td>
                      <td className="text-right">{formatMoney(partLineTotal(p), { currency: r.currency || undefined })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-xs text-gray-500">Parts {formatMoney(r.partsTotal, { currency: r.currency || undefined })} + labour / service {formatMoney(r.labourCost, { currency: r.currency || undefined })}</p>
            {r.invoiceFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.invoiceFiles.map((f) => (
                  <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">
                    <Paperclip className="h-3 w-3" /> {f.name}
                  </a>
                ))}
              </div>
            )}
            {r.notes && <p className="mt-2 text-xs italic text-gray-500">{r.notes}</p>}
          </div>
        ))}
      </div>
      {adding && <AddJobDialog machineId={machineId} siteId={siteId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddJobDialog({ machineId, siteId, onClose }: { machineId: string; siteId: string; onClose: () => void }) {
  const profile = useAuthStore((s) => s.userProfile);
  const currency = getCompanyCurrency();
  const { contractors } = useContractors();
  const today = new Date().toISOString().slice(0, 10);
  const [contractorName, setContractorName] = useState('');
  const [jobType, setJobType] = useState<OutsourcedJobType>('repair');
  const [description, setDescription] = useState('');
  const [startedAt, setStartedAt] = useState(today);
  const [completedAt, setCompletedAt] = useState(today);
  const [parts, setParts] = useState<OutsourcedPart[]>([]);
  const [labour, setLabour] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const labourCost = Number(labour) || 0;
  const totals = outsourcedJobTotals(parts, labourCost);
  const setPart = (i: number, patch: Partial<OutsourcedPart>) => setParts((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const matched = contractors.find((c) => c.companyName.trim().toLowerCase() === contractorName.trim().toLowerCase());

  async function save() {
    if (!profile) return;
    if (!contractorName.trim()) return toast.error('Enter the contractor / company that did the work.');
    if (!startedAt) return toast.error('Enter the date the work started.');
    if (completedAt && dayMs(completedAt) < dayMs(startedAt)) return toast.error('Finish date is before the start date.');
    const named = parts.filter((p) => p.name.trim());
    if (named.some((p) => !(p.quantity > 0) || p.unitPrice < 0)) return toast.error('Each part needs a quantity above 0 and a price.');
    if (labourCost < 0) return toast.error('Labour cost can’t be negative.');
    setSaving(true);
    try {
      await createOutsourcedMaintenance(profile.companyId, {
        siteId, machineId,
        contractorId: matched?.id ?? null,
        contractorName: contractorName.trim(),
        jobType, description: description.trim(),
        startedAt: dayMs(startedAt), completedAt: completedAt ? dayMs(completedAt) : null,
        parts: named.map((p) => ({ ...p, name: p.name.trim(), partNumber: p.partNumber?.trim() || undefined })),
        labourCost, currency, invoiceNumber: invoiceNumber.trim(), notes: notes.trim(),
        createdBy: profile.id, createdByName: profile.fullName,
      }, files);
      toast.success('Outsourced job saved.');
      onClose();
    } catch (e) {
      toast.error((e as Error).message || 'Could not save the job.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="my-6 w-full max-w-2xl space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add outsourced maintenance</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">Contractor / company *</span>
            <input className={input} list="outsourced-contractors" value={contractorName} onChange={(e) => setContractorName(e.target.value)} placeholder="Pick from your contractors or type" />
            <datalist id="outsourced-contractors">{contractors.map((c) => <option key={c.id} value={c.companyName} />)}</datalist></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">Type of work</span>
            <select className={input} value={jobType} onChange={(e) => setJobType(e.target.value as OutsourcedJobType)}>
              {OUTSOURCED_JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">Started *</span>
            <input type="date" className={input} value={startedAt} onChange={(e) => setStartedAt(e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">Finished</span>
            <input type="date" className={input} value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} /></label>
          <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium text-gray-700">What was done</span>
            <textarea className={input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Replaced main bearings and re-aligned the shaft" /></label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Parts replaced or added</span>
            <button type="button" onClick={() => setParts((p) => [...p, emptyPart()])} className="text-sm text-blue-600 hover:text-blue-800">+ Add part</button>
          </div>
          {parts.length === 0 && <p className="text-xs text-gray-500">No parts fitted? Leave empty and enter only the labour / service charge.</p>}
          <div className="space-y-2">
            {parts.map((p, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-200 p-2">
                <label className="col-span-12 text-xs sm:col-span-4">Part<input className={input} value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} placeholder="Bearing 6205" /></label>
                <label className="col-span-6 text-xs sm:col-span-2">Part no.<input className={input} value={p.partNumber ?? ''} onChange={(e) => setPart(i, { partNumber: e.target.value })} /></label>
                <label className="col-span-6 text-xs sm:col-span-2">Fitted as
                  <select className={input} value={p.kind} onChange={(e) => setPart(i, { kind: e.target.value as OutsourcedPart['kind'] })}>
                    <option value="replaced">Replaced</option><option value="added">Added</option>
                  </select></label>
                <label className="col-span-3 text-xs sm:col-span-1">Qty<input type="number" min={1} className={input} value={p.quantity} onChange={(e) => setPart(i, { quantity: Number(e.target.value) })} /></label>
                <label className="col-span-5 text-xs sm:col-span-2">Unit price<input type="number" min={0} className={input} value={p.unitPrice || ''} onChange={(e) => setPart(i, { unitPrice: Number(e.target.value) })} /></label>
                <button type="button" aria-label="Remove part" onClick={() => setParts((x) => x.filter((_, j) => j !== i))} className="col-span-4 pb-2 text-gray-400 hover:text-red-600 sm:col-span-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">Labour / service charge ({currency})</span>
            <input type="number" min={0} className={input} value={labour} onChange={(e) => setLabour(e.target.value)} placeholder="0" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-gray-700">Invoice number</span>
            <input className={input} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></label>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex justify-between text-gray-600"><span>Parts</span><span>{formatMoney(totals.partsTotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Labour / service</span><span>{formatMoney(labourCost)}</span></div>
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900"><span>Total cost</span><span>{formatMoney(totals.total)}</span></div>
        </div>

        <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">Invoices / bills (PDF or photos, up to 15 MB each)</span>
          <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="block w-full text-sm text-gray-600" />
          {files.length > 0 && <span className="mt-1 block text-xs text-gray-500">{files.length} file(s) selected</span>}</label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">Notes</span>
          <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Warranty given, follow-up needed…" /></label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save job'}</button>
        </div>
      </div>
    </div>
  );
}
