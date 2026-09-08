import { CheckCircle, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import type { ValidationResult, ParsedPartRow } from '@/types/inventory';
import { ImportErrorTable } from './ImportErrorTable';
import { ImportPreviewTable } from './ImportPreviewTable';
import { useTranslation } from 'react-i18next';

interface ImportValidationResultsProps {
  validationResult: ValidationResult;
  existingPartNumbers: Set<string>;
  onConfirm: () => void;
  onReUpload: () => void;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}

export function ImportValidationResults({
  validationResult,
  existingPartNumbers,
  onConfirm,
  onReUpload,
}: ImportValidationResultsProps) {
  const { t } = useTranslation();
  const { validRows, errors, createCount, updateCount, isValid } = validationResult;
  const totalRows = validRows.length + errors.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {isValid ? (
          <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
        ) : (
          <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isValid ? t('common.inventory.import.validation.passed') : t('common.inventory.import.validation.failed')}
          </h2>
          <p className="text-sm text-gray-500">
            {isValid
              ? t('common.inventory.import.validation.allValid')
              : t('common.inventory.import.validation.errorsMustBeFixed', { count: errors.length })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label={t('common.inventory.import.validation.totalRows')} value={totalRows} color="bg-gray-50 text-gray-700" />
        <StatCard label={t('common.inventory.import.validation.valid')} value={validRows.length} color="bg-green-50 text-green-700" />
        <StatCard label={t('common.inventory.import.validation.errors')} value={errors.length} color={errors.length > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'} />
        <StatCard label={t('common.inventory.import.validation.create')} value={createCount} color="bg-green-50 text-green-700" />
        <StatCard label={t('common.inventory.import.validation.update')} value={updateCount} color="bg-blue-50 text-blue-700" />
      </div>

      {/* Content */}
      {!isValid ? (
        <div className="space-y-4">
          <ImportErrorTable errors={errors} />
          <button
            onClick={onReUpload}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.inventory.import.validation.uploadNewFile')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <ImportPreviewTable
            rows={validRows as ParsedPartRow[]}
            createCount={createCount}
            updateCount={updateCount}
            existingPartNumbers={existingPartNumbers}
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {t('common.inventory.import.validation.confirmImport')}
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onReUpload}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium rounded-xl transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.inventory.import.validation.uploadDifferentFile')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
