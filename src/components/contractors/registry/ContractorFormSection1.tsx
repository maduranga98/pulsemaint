import { useTranslation } from 'react-i18next';
import type { Contractor } from '@/lib/contractors/contractorTypes';

interface Props {
  initial?: Partial<Contractor>;
}

export function ContractorFormSection1({ initial }: Props) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4" id="contractor-form-company">
      <h2 className="text-lg font-semibold text-slate-950">{t('common.contractors.registry.formSection1.title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="companyName" defaultValue={initial?.companyName ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.companyName')} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="tradeName" defaultValue={initial?.tradeName ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.tradeName')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="registrationNumber" defaultValue={initial?.registrationNumber ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.registrationNumber')} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select name="companyType" defaultValue={initial?.companyType ?? 'private_ltd'} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="private_ltd">{t('common.contractors.registry.formSection1.companyTypes.private_ltd')}</option>
          <option value="sole_proprietor">{t('common.contractors.registry.formSection1.companyTypes.sole_proprietor')}</option>
          <option value="partnership">{t('common.contractors.registry.formSection1.companyTypes.partnership')}</option>
          <option value="public_ltd">{t('common.contractors.registry.formSection1.companyTypes.public_ltd')}</option>
          <option value="foreign">{t('common.contractors.registry.formSection1.companyTypes.foreign')}</option>
        </select>
        <input name="dateEstablished" defaultValue={initial?.dateEstablished ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.dateEstablished')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="city" defaultValue={initial?.city ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.city')} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="district" defaultValue={initial?.district ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.district')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="country" defaultValue={initial?.country ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.country')} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="website" defaultValue={initial?.website ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.website')} className="h-10 rounded-md border border-slate-200 px-3 text-sm sm:col-span-2" />
        <textarea name="primaryAddress" defaultValue={initial?.primaryAddress ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.primaryAddress')} required className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
        <textarea name="notes" defaultValue={initial?.notes ?? ''} placeholder={t('common.contractors.registry.formSection1.fields.notes')} className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
      </div>
    </section>
  );
}

export default ContractorFormSection1;
