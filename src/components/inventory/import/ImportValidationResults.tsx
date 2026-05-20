import { CheckCircle, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import type { ValidationResult, ParsedPartRow } from '@/types/inventory';
import { ImportErrorTable } from './ImportErrorTable';
import { ImportPreviewTable } from './ImportPreviewTable';

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
          <h2 className="text-xl font-bold text-gray-900 font-[Sora]">
            {isValid ? 'Validation Passed' : 'Validation Failed'}
          </h2>
          <p className="text-sm text-gray-500">
            {isValid
              ? 'All rows are valid and ready to import.'
              : `${errors.length} error${errors.length !== 1 ? 's' : ''} must be fixed before importing.`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Rows" value={totalRows} color="bg-gray-50 text-gray-700" />
        <StatCard label="Valid" value={validRows.length} color="bg-green-50 text-green-700" />
        <StatCard label="Errors" value={errors.length} color={errors.length > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'} />
        <StatCard label="Create" value={createCount} color="bg-green-50 text-green-700" />
        <StatCard label="Update" value={updateCount} color="bg-blue-50 text-blue-700" />
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
            Upload New File
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
              Confirm Import
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onReUpload}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium rounded-xl transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Upload Different File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
