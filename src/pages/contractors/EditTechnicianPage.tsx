import TechnicianForm from '@/components/contractors/technicians/TechnicianForm';

export function EditTechnicianPage() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Edit Technician</h1>
        <p className="mt-1 text-sm text-slate-500">Update contractor technician details and status.</p>
      </div>
      <TechnicianForm />
    </div>
  );
}

export default EditTechnicianPage;
