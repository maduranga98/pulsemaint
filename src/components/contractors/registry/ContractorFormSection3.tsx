import { useTranslation } from 'react-i18next';
import { CONTRACTOR_SPECIALIZATION_TAGS, SPECIALIZATION_LABELS, type Contractor } from '@/lib/contractors/contractorTypes';

interface Props {
  initial?: Partial<Contractor>;
}

export function ContractorFormSection3({ initial }: Props) {
  const { t } = useTranslation();
  const tags = new Set(initial?.specializationTags ?? []);
  return (
    <section className="space-y-4" id="contractor-form-specializations">
      <h2 className="text-lg font-semibold text-slate-950">{t('common.contractors.registry.formSection3.title')}</h2>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">{t('common.contractors.registry.formSection3.specializationTags')}</p>
        <div className="flex flex-wrap gap-2">
          {CONTRACTOR_SPECIALIZATION_TAGS.map((tag) => (
            <label key={tag} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
              <input type="checkbox" name="specializationTags" value={tag} defaultChecked={tags.has(tag)} className="mr-1" /> {t(`common.contractors.registry.specializationTags.${tag}`, SPECIALIZATION_LABELS[tag])}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="machineTypesServiced" defaultValue={(initial?.machineTypesServiced ?? []).join(', ')} placeholder={t('common.contractors.registry.formSection3.fields.machineTypesServiced')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="industriesServed" defaultValue={(initial?.industriesServed ?? []).join(', ')} placeholder={t('common.contractors.registry.formSection3.fields.industriesServed')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="geographicCoverage" defaultValue={(initial?.geographicCoverage ?? []).join(', ')} placeholder={t('common.contractors.registry.formSection3.fields.geographicCoverage')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select name="serviceHours" defaultValue={initial?.serviceHours ?? 'business_hours'} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="24_7">{t('common.contractors.registry.formSection3.serviceHours.24_7')}</option>
          <option value="business_hours">{t('common.contractors.registry.formSection3.serviceHours.business_hours')}</option>
          <option value="on_call">{t('common.contractors.registry.formSection3.serviceHours.on_call')}</option>
          <option value="custom">{t('common.contractors.registry.formSection3.serviceHours.custom')}</option>
        </select>
        <input name="emergencyResponseTime" defaultValue={initial?.emergencyResponseTime ?? ''} placeholder={t('common.contractors.registry.formSection3.fields.emergencyResponseTime')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="teamSizeAvailable" type="number" defaultValue={initial?.teamSizeAvailable ?? ''} placeholder={t('common.contractors.registry.formSection3.fields.teamSizeAvailable')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="languagesSpoken" defaultValue={(initial?.languagesSpoken ?? []).join(', ')} placeholder={t('common.contractors.registry.formSection3.fields.languagesSpoken')} className="h-10 rounded-md border border-slate-200 px-3 text-sm sm:col-span-2" />
      </div>
    </section>
  );
}

export default ContractorFormSection3;
