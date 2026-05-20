export function ContractorFormSection2() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-950">Contact Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <input placeholder="Primary Contact Name *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Designation" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Primary Phone *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Primary Email *" type="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Secondary Contact Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Secondary Phone" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Emergency Contact *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="WhatsApp Number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="phone">Phone</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>
    </section>
  );
}

export default ContractorFormSection2;
