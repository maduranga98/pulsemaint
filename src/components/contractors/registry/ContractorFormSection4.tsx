import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';

type CompletedProject = { name: string; cost: string };

export function ContractorFormSection4() {
  const access = useContractorAccess();
  const [projects, setProjects] = useState<CompletedProject[]>([{ name: '', cost: '' }]);

  if (!access.canViewFinancials) {
    return (
      <section id="contractor-form-financial" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Financial details are available to Plant Managers and Admins only.
      </section>
    );
  }

  function addProject() {
    setProjects((prev) => [...prev, { name: '', cost: '' }]);
  }

  function removeProject(index: number) {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  }

  function updateProject(index: number, field: keyof CompletedProject, value: string) {
    setProjects((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  return (
    <section className="space-y-5" id="contractor-form-financial">
      <h2 className="text-lg font-semibold text-slate-950">Financial &amp; Billing</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Payment Methods</h3>
        <div className="flex flex-wrap gap-3 text-sm text-slate-700">
          {['Bank Transfer', 'Cheque', 'Cash', 'Online / Wallet'].map((method) => (
            <label key={method} className="rounded-full border border-slate-200 px-3 py-1.5">
              <input type="checkbox" name="paymentMethods" value={method} className="mr-1.5" />
              {method}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Bank Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="bankName" placeholder="Bank Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankBranch" placeholder="Branch" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankAccountName" placeholder="Account Holder Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankAccountNumber" placeholder="Account Number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="bankRoutingNumber" placeholder="Routing / SWIFT" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <input name="taxRegistrationNumber" placeholder="TIN Number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Previously Completed Projects (with costs)</h3>
          <button
            type="button"
            onClick={addProject}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {projects.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
              <input
                name="completedProjectName"
                value={p.name}
                onChange={(e) => updateProject(i, 'name', e.target.value)}
                placeholder="Project / Client Name"
                className="h-10 rounded-md border border-slate-200 px-3 text-sm"
              />
              <input
                name="completedProjectCost"
                value={p.cost}
                onChange={(e) => updateProject(i, 'cost', e.target.value)}
                placeholder="Cost (LKR)"
                className="h-10 rounded-md border border-slate-200 px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => removeProject(i)}
                disabled={projects.length === 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Remove project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ContractorFormSection4;
