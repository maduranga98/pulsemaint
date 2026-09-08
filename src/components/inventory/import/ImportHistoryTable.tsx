import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, RotateCcw } from 'lucide-react';
import type { InventoryImportSession } from '@/types/inventory';
import { ImportStatusBadge } from '@/components/inventory/shared/ImportStatusBadge';

interface ImportHistoryTableProps {
  sessions: InventoryImportSession[];
  onReverseImport?: (sessionId: string) => Promise<void>;
}

function formatDate(ts: InventoryImportSession['startedAt']): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleString();
}

function isWithin24h(ts: InventoryImportSession['startedAt']): boolean {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportHistoryTable({ sessions, onReverseImport }: ImportHistoryTableProps) {
  const { t } = useTranslation();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reversing, setReversing] = useState(false);

  async function handleReverse() {
    if (!confirmId || !onReverseImport) return;
    setReversing(true);
    try {
      await onReverseImport(confirmId);
    } finally {
      setReversing(false);
      setConfirmId(null);
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">{t('common.inventory.import.historyTable.emptyTitle')}</p>
        <p className="text-sm mt-1">{t('common.inventory.import.historyTable.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.date')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.file')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.rows')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.created')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.updated')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.errors')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.importedBy')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.status')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.import.historyTable.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((s) => {
              const canUndo =
                s.status === 'completed' && isWithin24h(s.startedAt) && !!onReverseImport;
              return (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(s.startedAt)}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 font-medium truncate max-w-[200px]">{s.fileName}</p>
                    <p className="text-xs text-gray-400">{formatBytes(s.fileSizeBytes)}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{s.totalRows}</td>
                  <td className="px-4 py-3 text-green-700 font-medium">{s.newPartsCount}</td>
                  <td className="px-4 py-3 text-blue-700 font-medium">{s.updatedPartsCount}</td>
                  <td className="px-4 py-3">
                    {s.errorRows > 0 ? (
                      <span className="text-red-600 font-medium">{s.errorRows}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.importedByName}</td>
                  <td className="px-4 py-3">
                    <ImportStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        <Eye className="w-3 h-3" />
                        {t('common.inventory.import.historyTable.details')}
                      </button>
                      {canUndo && (
                        <button
                          onClick={() => setConfirmId(s.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t('common.inventory.import.historyTable.undo')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Undo confirmation modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{t('common.inventory.import.historyTable.undoModal.title')}</h3>
            <p className="text-sm text-gray-600">
              {t('common.inventory.import.historyTable.undoModal.body')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                disabled={reversing}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                {t('common.inventory.import.historyTable.undoModal.cancel')}
              </button>
              <button
                onClick={handleReverse}
                disabled={reversing}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {reversing
                  ? t('common.inventory.import.historyTable.undoModal.undoing')
                  : t('common.inventory.import.historyTable.undoModal.yesUndo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
