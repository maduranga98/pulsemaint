import { useTranslation } from 'react-i18next';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';

interface PartsUsedSectionProps {
  job: ContractorJob;
}

export function PartsUsedSection({ job }: PartsUsedSectionProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">{t('common.contractors.jobs.partsUsed.title')}</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{t('common.contractors.jobs.partsUsed.factoryParts.title')}</h3>
          <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
            {job.partsFromFactory.length ? job.partsFromFactory.map((part) => (
              <div key={`${part.partId}-${part.partNumber}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                <span>{t('common.contractors.jobs.partsUsed.factoryParts.line', { name: part.partName, quantity: part.quantityUsed })}</span>
                <span className="font-semibold">{formatLkr(part.totalCost)}</span>
              </div>
            )) : <p className="p-3 text-sm text-slate-500">{t('common.contractors.jobs.partsUsed.factoryParts.empty')}</p>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{t('common.contractors.jobs.partsUsed.contractorMaterials.title')}</h3>
          <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
            {job.partsFromContractor.length ? job.partsFromContractor.map((part) => (
              <div key={`${part.description}-${part.unit}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                <span>{t('common.contractors.jobs.partsUsed.contractorMaterials.line', { description: part.description, quantity: part.quantity, unit: part.unit })}</span>
                <span className="font-semibold">{formatLkr(part.estimatedCost)}</span>
              </div>
            )) : <p className="p-3 text-sm text-slate-500">{t('common.contractors.jobs.partsUsed.contractorMaterials.empty')}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default PartsUsedSection;
