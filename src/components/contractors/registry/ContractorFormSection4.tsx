import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';

export function ContractorFormSection4() {
  const access = useContractorAccess();
  if (!access.canViewFinancials) {
    return <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Financial details are available to Plant Managers and Admins only.</section>;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-950">Financial & Billing</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <select className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option>Net 30</option><option>Net 14</option><option>Net 7</option></select>
        <select className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option>LKR</option><option>USD</option><option>SGD</option></select>
        <input type="number" placeholder="Standard Labor Rate - LKR/hour" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder="Overtime Rate - LKR/hour" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder="Emergency Call-Out Fee" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder="Minimum Charge" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Travel/Mobilization Fee" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Bank Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Bank Branch" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Bank Account Number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Tax Registration No" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
    </section>
  );
}

export default ContractorFormSection4;
