import ContractorFormLayout from '@/components/contractors/registry/ContractorFormLayout';

export function AddContractorPage() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Add Contractor</h1>
        <p className="mt-1 text-sm text-slate-500">Create an external contractor profile. Contractors do not receive PulseMaint login access.</p>
      </div>
      <ContractorFormLayout mode="new" />
    </div>
  );
}

export default AddContractorPage;
