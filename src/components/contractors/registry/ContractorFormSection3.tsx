import { CONTRACTOR_SPECIALIZATION_TAGS, SPECIALIZATION_LABELS, type Contractor } from '@/lib/contractors/contractorTypes';

interface Props {
  initial?: Partial<Contractor>;
}

export function ContractorFormSection3({ initial }: Props) {
  const tags = new Set(initial?.specializationTags ?? []);
  return (
    <section className="space-y-4" id="contractor-form-specializations">
      <h2 className="text-lg font-semibold text-slate-950">Specializations</h2>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Specialization Tags *</p>
        <div className="flex flex-wrap gap-2">
          {CONTRACTOR_SPECIALIZATION_TAGS.map((tag) => (
            <label key={tag} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
              <input type="checkbox" name="specializationTags" value={tag} defaultChecked={tags.has(tag)} className="mr-1" /> {SPECIALIZATION_LABELS[tag]}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="machineTypesServiced" defaultValue={(initial?.machineTypesServiced ?? []).join(', ')} placeholder="Machine Types Serviced" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="industriesServed" defaultValue={(initial?.industriesServed ?? []).join(', ')} placeholder="Industries Served" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="geographicCoverage" defaultValue={(initial?.geographicCoverage ?? []).join(', ')} placeholder="Geographic Coverage" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select name="serviceHours" defaultValue={initial?.serviceHours ?? 'business_hours'} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="24_7">24/7</option>
          <option value="business_hours">Business Hours</option>
          <option value="on_call">On Call</option>
          <option value="custom">Custom</option>
        </select>
        <input name="emergencyResponseTime" defaultValue={initial?.emergencyResponseTime ?? ''} placeholder="Emergency Response Time" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="teamSize" type="number" defaultValue={initial?.teamSizeAvailable ?? ''} placeholder="Team Size Available" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input name="languagesSpoken" defaultValue={(initial?.languagesSpoken ?? []).join(', ')} placeholder="Languages Spoken" className="h-10 rounded-md border border-slate-200 px-3 text-sm sm:col-span-2" />
      </div>
    </section>
  );
}

export default ContractorFormSection3;
