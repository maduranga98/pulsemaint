import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import type { Contractor } from '@/lib/contractors/contractorTypes';

type CompletedProject = {
  name: string;
  cost: string;
  rating: string;
  duration: string;
  contractType: string;
  forbiddenActions: string;
};

const EMPTY_PROJECT: CompletedProject = {
  name: '', cost: '', rating: '', duration: '', contractType: '', forbiddenActions: '',
};

interface Props {
  initial?: Partial<Contractor> & { previouslyCompletedProjects?: CompletedProject[]; paymentMethods?: string[] };
}

export function ContractorFormSection4({ initial }: Props) {
  const { t } = useTranslation();
  const access = useContractorAccess();
  const seededProjects = initial?.previouslyCompletedProjects?.length
    ? initial.previouslyCompletedProjects.map((p) => ({
        name: p.name ?? '',
        cost: p.cost ?? '',
        rating: (p as CompletedProject).rating ?? '',
        duration: (p as CompletedProject).duration ?? '',
        contractType: (p as CompletedProject).contractType ?? '',
        forbiddenActions: (p as CompletedProject).forbiddenActions ?? '',
      }))
    : [{ ...EMPTY_PROJECT }];
  const [projects, setProjects] = useState<CompletedProject[]>(seededProjects);
  const paymentMethods = new Set(initial?.paymentMethods ?? []);

  if (!access.canViewFinancials) {
    return (
      <section id="contractor-form-financial" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {t('common.contractors.registry.formSection4.restricted')}
      </section>
    );
  }

  function addProject() {
    setProjects((prev) => [...prev, { ...EMPTY_PROJECT }]);
  }

  function removeProject(index: number) {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  }

  function updateProject(index: number, field: keyof CompletedProject, value: string) {
    setProjects((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  const PAYMENT_METHOD_KEYS = ['bankTransfer', 'cheque', 'cash', 'onlineWallet'] as const;
  const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHOD_KEYS)[number], string> = {
    bankTransfer: 'Bank Transfer', cheque: 'Cheque', cash: 'Cash', onlineWallet: 'Online / Wallet',
  };

  return (
    <section className="space-y-5" id="contractor-form-financial">
      <h2 className="text-lg font-semibold text-slate-950">{t('common.contractors.registry.formSection4.title')}</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('common.contractors.registry.formSection4.paymentMethods')}</h3>
        <div className="flex flex-wrap gap-3 text-sm text-slate-700">
          {PAYMENT_METHOD_KEYS.map((key) => {
            const method = PAYMENT_METHOD_LABELS[key];
            return (
              <label key={key} className="rounded-full border border-slate-200 px-3 py-1.5">
                <input type="checkbox" name="paymentMethods" value={method} defaultChecked={paymentMethods.has(method)} className="mr-1.5" />
                {t(`common.contractors.registry.formSection4.paymentMethodOptions.${key}`, method)}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('common.contractors.registry.formSection4.bankDetails')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="bankName" defaultValue={initial?.bankName ?? ''} placeholder={t('common.contractors.registry.formSection4.fields.bankName')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankBranch" defaultValue={initial?.bankBranch ?? ''} placeholder={t('common.contractors.registry.formSection4.fields.branch')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankAccountName" defaultValue={initial?.bankAccountName ?? ''} placeholder={t('common.contractors.registry.formSection4.fields.accountHolderName')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankAccountNumber" defaultValue={initial?.bankAccountNumber ?? ''} placeholder={t('common.contractors.registry.formSection4.fields.accountNumber')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankRoutingNumber" defaultValue={initial?.bankRoutingNumber ?? ''} placeholder={t('common.contractors.registry.formSection4.fields.routingSwift')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="taxRegistrationNumber" defaultValue={initial?.taxRegistrationNumber ?? ''} placeholder={t('common.contractors.registry.formSection4.fields.tinNumber')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t('common.contractors.registry.formSection4.completedProjects')}</h3>
          <button
            type="button"
            onClick={addProject}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            <Plus className="h-3 w-3" /> {t('common.contractors.registry.formSection4.actions.add')}
          </button>
        </div>
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  name="completedProjectName"
                  value={p.name}
                  onChange={(e) => updateProject(i, 'name', e.target.value)}
                  placeholder={t('common.contractors.registry.formSection4.fields.projectClientName')}
                  className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeProject(i)}
                  disabled={projects.length === 1}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  aria-label={t('common.contractors.registry.formSection4.actions.removeProject')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  name="completedProjectCost"
                  value={p.cost}
                  onChange={(e) => updateProject(i, 'cost', e.target.value)}
                  placeholder={t('common.contractors.registry.formSection4.fields.costLkr')}
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                />
                <select
                  name="completedProjectRating"
                  value={p.rating}
                  onChange={(e) => updateProject(i, 'rating', e.target.value)}
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-700"
                >
                  <option value="">{t('common.contractors.registry.formSection4.fields.ratingPlaceholder')}</option>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>{r} ★</option>
                  ))}
                </select>
                <input
                  name="completedProjectDuration"
                  value={p.duration}
                  onChange={(e) => updateProject(i, 'duration', e.target.value)}
                  placeholder={t('common.contractors.registry.formSection4.fields.duration')}
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                />
                <input
                  name="completedProjectContractType"
                  value={p.contractType}
                  onChange={(e) => updateProject(i, 'contractType', e.target.value)}
                  placeholder={t('common.contractors.registry.formSection4.fields.contractType')}
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                />
              </div>
              <textarea
                name="completedProjectForbiddenActions"
                value={p.forbiddenActions}
                onChange={(e) => updateProject(i, 'forbiddenActions', e.target.value)}
                placeholder={t('common.contractors.registry.formSection4.fields.forbiddenActions')}
                rows={2}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ContractorFormSection4;
