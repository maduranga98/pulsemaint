import { Upload } from 'lucide-react';

export function ContractorFormSection5() {
  return (
    <section className="space-y-4" id="contractor-form-documents">
      <h2 className="text-lg font-semibold text-slate-950">Initial Documents</h2>
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
        <Upload className="mb-2 h-7 w-7 text-blue-600" />
        Drag files here or choose PDF, DOCX, JPG, PNG
        <input type="file" multiple className="hidden" />
      </label>
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        You can add more documents from the contractor profile later.
      </div>
    </section>
  );
}

export default ContractorFormSection5;
