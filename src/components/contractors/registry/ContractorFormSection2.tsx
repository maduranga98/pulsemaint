import { useTranslation } from 'react-i18next';
import type { Contractor } from '@/lib/contractors/contractorTypes';

interface Props {
  initial?: Partial<Contractor>;
}

export function ContractorFormSection2({ initial }: Props) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4" id="contractor-form-contacts">
      <h2 className="text-lg font-semibold text-slate-950">{t('common.contractors.registry.formSection2.title')}</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('common.contractors.registry.formSection2.primaryContact')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="primaryContactName" defaultValue={initial?.primaryContactName ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.fullName')} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryContactDesig" defaultValue={initial?.primaryContactDesig ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.designation')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryPhone" defaultValue={initial?.primaryPhone ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.phone')} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryEmail" defaultValue={initial?.primaryEmail ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.email')} type="email" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('common.contractors.registry.formSection2.secondaryContact')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="secondaryContactName" defaultValue={initial?.secondaryContactName ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.fullNameOptional')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryContactDesig" placeholder={t('common.contractors.registry.formSection2.fields.designation')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryPhone" defaultValue={initial?.secondaryPhone ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.phoneOptional')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryEmail" defaultValue={initial?.secondaryEmail ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.emailOptional')} type="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('common.contractors.registry.formSection2.other')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="emergencyContact" defaultValue={initial?.emergencyContact ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.emergencyContact')} required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="whatsappNumber" defaultValue={initial?.whatsappNumber ?? ''} placeholder={t('common.contractors.registry.formSection2.fields.whatsappNumber')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>
    </section>
  );
}

export default ContractorFormSection2;
