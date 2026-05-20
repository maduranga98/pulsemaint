import { CONTRACTOR_SPECIALIZATION_TAGS, SPECIALIZATION_LABELS } from '@/lib/contractors/contractorTypes';
import PhotoUploadCrop from './PhotoUploadCrop';

export function TechnicianForm() {
  return (
    <form className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
      <PhotoUploadCrop />
      <div className="grid gap-4 sm:grid-cols-2">
        <input placeholder="Full name *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="NIC/Passport *" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="engineer">Engineer</option>
          <option value="senior_technician">Senior Technician</option>
          <option value="technician">Technician</option>
          <option value="helper">Helper</option>
          <option value="other">Other</option>
        </select>
        <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <input placeholder="Phone" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Specialization</p>
        <div className="flex flex-wrap gap-2">
          {CONTRACTOR_SPECIALIZATION_TAGS.map((tag) => (
            <label key={tag} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">
              <input type="checkbox" className="mr-1" /> {SPECIALIZATION_LABELS[tag]}
            </label>
          ))}
        </div>
      </div>
      <input placeholder="Certifications, comma separated" className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
      <button type="button" className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Save Technician</button>
    </form>
  );
}

export default TechnicianForm;
