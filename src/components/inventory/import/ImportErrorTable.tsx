import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { ValidationError } from '@/types/inventory';

interface ImportErrorTableProps {
  errors: ValidationError[];
}

export function ImportErrorTable({ errors }: ImportErrorTableProps) {
  const { t } = useTranslation();

  function handleDownload() {
    console.log('[ImportErrorTable] Download error report:', errors);
  }

  if (errors.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-red-700 text-sm">
          {t('common.inventory.import.errorTable.errorsFound', { count: errors.length })}
        </h3>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {t('common.inventory.import.errorTable.downloadReport')}
        </button>
      </div>

      <div className="overflow-x-auto max-h-72 overflow-y-auto border border-red-200 rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-red-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-red-800 whitespace-nowrap">{t('common.inventory.import.errorTable.columns.row')}</th>
              <th className="px-3 py-2 text-left font-semibold text-red-800 whitespace-nowrap">{t('common.inventory.import.errorTable.columns.column')}</th>
              <th className="px-3 py-2 text-left font-semibold text-red-800 whitespace-nowrap">{t('common.inventory.import.errorTable.columns.errorCode')}</th>
              <th className="px-3 py-2 text-left font-semibold text-red-800 whitespace-nowrap">{t('common.inventory.import.errorTable.columns.message')}</th>
              <th className="px-3 py-2 text-left font-semibold text-red-800 whitespace-nowrap">{t('common.inventory.import.errorTable.columns.fixHint')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100">
            {errors.map((err, idx) => (
              <tr key={idx} className="bg-red-50/40 hover:bg-red-50 transition-colors">
                <td className="px-3 py-2 font-mono font-medium text-red-900">{err.row}</td>
                <td className="px-3 py-2 text-red-700 whitespace-nowrap">{err.column}</td>
                <td className="px-3 py-2 font-mono text-red-600 whitespace-nowrap">{err.errorCode}</td>
                <td className="px-3 py-2 text-gray-800">{err.message}</td>
                <td className="px-3 py-2 text-gray-600 italic">{err.fixHint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
