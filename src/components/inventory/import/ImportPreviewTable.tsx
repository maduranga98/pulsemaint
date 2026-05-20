import type { ParsedPartRow } from '@/types/inventory';

interface ImportPreviewTableProps {
  rows: ParsedPartRow[];
  createCount: number;
  updateCount: number;
  existingPartNumbers: Set<string>;
}

export function ImportPreviewTable({
  rows,
  createCount,
  updateCount,
  existingPartNumbers,
}: ImportPreviewTableProps) {
  const previewRows = rows.slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-600">
          Showing first {previewRows.length} of {rows.length} rows. All rows validated.
        </p>
        <p className="text-sm font-medium text-gray-800">
          <span className="text-green-700">{createCount} new parts will be created</span>
          {updateCount > 0 && (
            <>
              {' · '}
              <span className="text-blue-700">{updateCount} parts will be updated</span>
            </>
          )}
        </p>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Part Number</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Part Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Category</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Unit</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Stock</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Unit Cost</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {previewRows.map((row) => {
              const isUpdate = existingPartNumbers.has(row.partNumber);
              return (
                <tr
                  key={row.rowIndex}
                  className={`border-l-4 ${isUpdate ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-green-500 bg-green-50/30'}`}
                >
                  <td className="px-3 py-2 font-mono font-medium text-gray-900">{row.partNumber}</td>
                  <td className="px-3 py-2 text-gray-800 max-w-[160px] truncate">{row.name}</td>
                  <td className="px-3 py-2 text-gray-600">{row.category || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.unit || '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{row.currentStock || '0'}</td>
                  <td className="px-3 py-2 text-gray-800">{row.unitCost ? `LKR ${row.unitCost}` : '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide
                        ${isUpdate ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}
                      `}
                    >
                      {isUpdate ? 'UPDATE' : 'CREATE'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
