import HandoverCreateForm from '@/components/handover/HandoverCreateForm';

export function HandoverCreatePage() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="font-[Sora] text-2xl font-bold text-slate-950">Create Shift Handover</h1>
        <p className="mt-1 text-sm text-slate-500">Review the compiled shift summary and transfer accountability to the incoming supervisor.</p>
      </div>
      <HandoverCreateForm />
    </div>
  );
}

export default HandoverCreatePage;
