export function ContractorFormSection1() {
  return (
    <section className="space-y-4" id="contractor-form-company">
      <h2 className="text-lg font-semibold text-slate-950">Company Information</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="companyName" placeholder="Company Name *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="tradeName" placeholder="Trade Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="registrationNumber" placeholder="Registration Number *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select name="companyType" className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="private_ltd">Private Ltd</option>
          <option value="sole_proprietor">Sole Proprietor</option>
          <option value="partnership">Partnership</option>
          <option value="public_ltd">Public Ltd</option>
          <option value="foreign">Foreign</option>
        </select>
        <input name="dateEstablished" placeholder="Established year" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="city" placeholder="City *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="district" placeholder="District" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="country" placeholder="Country *" required className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="website" placeholder="Website" className="h-10 rounded-md border border-slate-200 px-3 text-sm sm:col-span-2" />
        <textarea name="primaryAddress" placeholder="Primary Address *" required className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
        <textarea name="notes" placeholder="Internal Notes" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
      </div>
    </section>
  );
}

export default ContractorFormSection1;
