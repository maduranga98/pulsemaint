import { Download, ArrowRight, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { generateImportTemplate } from '@/lib/inventory/importParser';

interface ImportTemplateStepProps {
  onDownload: () => void;
  onNext: () => void;
}

export function ImportTemplateStep({ onDownload, onNext }: ImportTemplateStepProps) {
  async function handleDownload() {
    try {
      const blob = await generateImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pulsemaint_inventory_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      onDownload();
    } catch (err) {
      console.error('Template download failed', err);
    }
  }

  const TIPS = [
    'Columns marked with * are required — leave them blank and that row will fail validation.',
    'If a Part Number already exists in the system, the row will update that part.',
    'Dates must be in YYYY-MM-DD format (e.g. 2025-01-15).',
    'See the "Valid Units" and "Valid Categories" sheets inside the template for allowed values.',
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 font-[Sora]">Import Inventory from Excel</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Use our template to import or update parts in bulk.
        </p>
      </div>

      {/* Step guide */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">How it works</h3>
        <ol className="space-y-3">
          {[
            'Download the template below and fill in your part data.',
            'Upload the completed file (max 10 MB, .xlsx only).',
            'We validate every row — fix any errors before proceeding.',
            'Review the import preview, then confirm to apply changes.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Template info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <FileSpreadsheet className="w-6 h-6 text-blue-600 shrink-0" />
          <h3 className="font-semibold text-blue-900">Template Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">4</p>
            <p className="text-gray-500 text-xs mt-0.5">Sheets</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">23</p>
            <p className="text-gray-500 text-xs mt-0.5">Columns</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">500</p>
            <p className="text-gray-500 text-xs mt-0.5">Max rows</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">10 MB</p>
            <p className="text-gray-500 text-xs mt-0.5">Max file size</p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm">Tips for success</h3>
        {TIPS.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            {tip}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>
        <button
          onClick={onNext}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
        >
          Next: Upload File
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
