export function ContractorFormSection2() {
  return (
    <section className="space-y-4" id="contractor-form-contacts">
      <h2 className="text-lg font-semibold text-slate-950">Contact Details</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Primary Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="primaryContactName" placeholder="Full Name *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryContactDesig" placeholder="Designation" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryPhone" placeholder="Phone *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="primaryEmail" placeholder="Email *" type="email" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Secondary Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="secondaryContactName" placeholder="Full Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryContactDesig" placeholder="Designation" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryPhone" placeholder="Phone" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="secondaryEmail" placeholder="Email" type="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Other</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="emergencyContact" placeholder="Emergency Contact *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="whatsappNumber" placeholder="WhatsApp Number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>
    </section>
  );
}

export default ContractorFormSection2;
