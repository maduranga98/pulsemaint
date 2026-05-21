export function ContractorFormSection2() {
  return (
    <section className="space-y-4" id="contractor-form-contacts">
      <h2 className="text-lg font-semibold text-slate-950">Contact Details</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Primary Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input placeholder="Full Name *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Designation" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Phone *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Email *" type="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Secondary Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input placeholder="Full Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Designation" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Phone" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Email" type="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Other</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input placeholder="Emergency Contact *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="WhatsApp Number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>
    </section>
  );
}

export default ContractorFormSection2;
