import { FileSpreadsheet, FileText } from 'lucide-react';

const REPORTS = [
  ['Contractor Performance Report', 'Per-contractor metrics, ratings, and MTTR'],
  ['Contractor Invoice Comparison', 'Invoices, variances, and approval status'],
  ['Job History Report', 'All jobs filterable by contractor, machine, and date'],
  ['Contractor Rating Report', 'Ratings breakdown and feedback trends'],
  ['Document Compliance Report', 'Document status across contractors'],
];

export function ReportsHubPage() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Contractor Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Generate PDF, Excel, or Google Sheets exports for Module 7.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {REPORTS.map(([title, description]) => (
          <article key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><FileText className="h-3.5 w-3.5" />Generate PDF</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><FileSpreadsheet className="h-3.5 w-3.5" />Export Excel</button>
              <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Push to Google Sheets</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default ReportsHubPage;
