import { useEffect, useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/lib/currency';
import { partLineTotal } from '../../lib/machineAsset';
import { deleteOutsourcedMaintenance, subscribeOutsourcedMaintenance } from '../../services/machineOutsourced.service';
import type { OutsourcedMaintenance } from '../../types/outsourcedMaintenance';

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Maintenance done by outside contractors on this machine: parts fitted, costs and invoices. */
export function OutsourcedMaintenanceSection({ machineId, siteId }: { machineId: string; siteId: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<OutsourcedMaintenance[]>([]);
  const [error, setError] = useState('');

  useEffect(() => subscribeOutsourcedMaintenance(siteId, machineId, setRows, (e) => setError(e.message)), [siteId, machineId]);

  const grand = rows.reduce((s, r) => s + r.totalCost, 0);

  async function remove(r: OutsourcedMaintenance) {
    if (!window.confirm(t('common.machines.asset.outsourced.deleteConfirm', { name: r.contractorName }))) return;
    try {
      await deleteOutsourcedMaintenance(r);
    } catch (e) {
      toast.error((e as Error).message || t('common.machines.asset.outsourced.deleteFailed'));
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">{t('common.machines.asset.outsourced.title')}</h3>
          <p className="text-xs text-gray-500">{t('common.machines.asset.outsourced.subtitle')}{rows.length > 0 && ` ${t('common.machines.asset.outsourced.total', { amount: formatMoney(grand) })}`}</p>
        </div>

      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {rows.length === 0 && !error && (
        <p className="text-sm text-gray-500">{t('common.machines.asset.outsourced.empty')} {t('common.machines.asset.outsourced.fromWorkOrder')}</p>
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{r.contractorName} <span className="font-normal text-gray-500">· {t(`common.machines.asset.outsourced.jobTypes.${r.jobType}`)}</span></p>
                <p className="text-xs text-gray-500">{fmtDay(r.startedAt)}{r.completedAt ? ` – ${fmtDay(r.completedAt)}` : ''}{r.invoiceNumber && ` · ${t('common.machines.asset.outsourced.invoice', { number: r.invoiceNumber })}`}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-gray-900">{formatMoney(r.totalCost, { currency: r.currency || undefined })}</span>
                <button type="button" title={t('common.machines.asset.outsourced.delete')} aria-label={t('common.machines.asset.outsourced.delete')} onClick={() => void remove(r)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {r.description && <p className="mt-2 text-gray-700">{r.description}</p>}
            {r.parts.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <thead><tr className="text-left text-gray-500"><th className="py-1">{t('common.machines.asset.outsourced.part')}</th><th>{t('common.machines.asset.outsourced.fittedAs')}</th><th className="text-right">{t('common.machines.asset.outsourced.qty')}</th><th className="text-right">{t('common.machines.asset.outsourced.unitPrice')}</th><th className="text-right">{t('common.machines.asset.outsourced.colTotal')}</th></tr></thead>
                <tbody>
                  {r.parts.map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1">{p.name}{p.partNumber && <span className="text-gray-400"> · {p.partNumber}</span>}</td>
                      <td>{p.kind === 'added' ? t('common.machines.asset.outsourced.added') : t('common.machines.asset.outsourced.replaced')}</td>
                      <td className="text-right">{p.quantity}</td>
                      <td className="text-right">{formatMoney(p.unitPrice, { currency: r.currency || undefined })}</td>
                      <td className="text-right">{formatMoney(partLineTotal(p), { currency: r.currency || undefined })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-xs text-gray-500">{t('common.machines.asset.outsourced.partsAndLabour', { parts: formatMoney(r.partsTotal, { currency: r.currency || undefined }), labour: formatMoney(r.labourCost, { currency: r.currency || undefined }) })}</p>
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
    </div>
  );
}
