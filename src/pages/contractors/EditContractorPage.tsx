import ContractorFormLayout from '@/components/contractors/registry/ContractorFormLayout';

export function EditContractorPage() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Edit Contractor</h1>
        <p className="mt-1 text-sm text-slate-500">Update profile, contacts, capabilities, and guarded financial fields.</p>
      </div>
      <ContractorFormLayout mode="edit" />
    </div>
  );
}

export default EditContractorPage;
