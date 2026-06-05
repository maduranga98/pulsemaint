import type { Contractor } from '@/lib/contractors/contractorTypes';

interface Props {
  initial?: Partial<Contractor>;
}

export function ContractorFormSection2({ initial }: Props) {
  return (
    <section className="space-y-4" id="contractor-form-contacts">
      <h2 className="text-lg font-semibold text-slate-950">Contact Details</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Primary Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="primaryContactName" defaultValue={initial?.primaryContactName ?? ''} placeholder="Full Name *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryContactDesig" defaultValue={initial?.primaryContactDesig ?? ''} placeholder="Designation" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryPhone" defaultValue={initial?.primaryPhone ?? ''} placeholder="Phone *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryEmail" defaultValue={initial?.primaryEmail ?? ''} placeholder="Email *" type="email" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Secondary Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="secondaryContactName" defaultValue={initial?.secondaryContactName ?? ''} placeholder="Full Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryContactDesig" placeholder="Designation" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryPhone" defaultValue={initial?.secondaryPhone ?? ''} placeholder="Phone" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryEmail" defaultValue={initial?.secondaryEmail ?? ''} placeholder="Email" type="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Other</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="emergencyContact" defaultValue={initial?.emergencyContact ?? ''} placeholder="Emergency Contact *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="whatsappNumber" defaultValue={initial?.whatsappNumber ?? ''} placeholder="WhatsApp Number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>
    </section>
  );
}

export default ContractorFormSection2;
