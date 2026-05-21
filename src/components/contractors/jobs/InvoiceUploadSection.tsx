import { Upload } from 'lucide-react';

export function InvoiceUploadSection() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">Upload Contractor Invoice</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input placeholder="Invoice reference" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder="Amount (LKR)" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-sm font-medium text-slate-600">
        <Upload className="h-4 w-4 text-blue-600" />
        Upload Invoice PDF
        <input type="file" accept="application/pdf" className="hidden" />
      </label>
    </section>
  );
}

export default InvoiceUploadSection;
