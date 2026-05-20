import { CONTRACTOR_SPECIALIZATION_TAGS, SPECIALIZATION_LABELS } from '@/lib/contractors/contractorTypes';

export function ContractorFormSection3() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-950">Specializations</h2>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Specialization Tags *</p>
        <div className="flex flex-wrap gap-2">
          {CONTRACTOR_SPECIALIZATION_TAGS.map((tag) => (
            <label key={tag} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
              <input type="checkbox" className="mr-1" /> {SPECIALIZATION_LABELS[tag]}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input placeholder="Machine Types Serviced" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Industries Served" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Geographic Coverage" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="24_7">24/7</option>
          <option value="business_hours">Business Hours</option>
          <option value="on_call">On Call</option>
          <option value="custom">Custom</option>
        </select>
        <input placeholder="Emergency Response Time" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder="Team Size Available" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Languages Spoken" className="h-10 rounded-md border border-slate-200 px-3 text-sm sm:col-span-2" />
      </div>
    </section>
  );
}

export default ContractorFormSection3;
