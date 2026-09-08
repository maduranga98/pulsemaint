import { useState } from 'react';
import { CheckCircle, History, Eye, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ImportCompleteScreenProps {
  newCount: number;
  updateCount: number;
  skippedCount: number;
  sessionId: string;
  onUndo: () => void;
  onViewParts: () => void;
}

export function ImportCompleteScreen({
  newCount,
  updateCount,
  skippedCount,
  onUndo,
  onViewParts,
}: ImportCompleteScreenProps) {
  const { t } = useTranslation();
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [undoing, setUndoing] = useState(false);

  async function handleUndo() {
    setUndoing(true);
    try {
      await Promise.resolve(onUndo());
    } finally {
      setUndoing(false);
      setShowUndoModal(false);
    }
  }

  return (
    <>
      <div className="max-w-lg mx-auto flex flex-col items-center gap-8 py-8 text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">{t('common.inventory.import.complete.title')}</h2>
          <p className="text-lg font-semibold text-gray-700">
            {t('common.inventory.import.complete.summary', { newCount, updateCount })}
          </p>
          {skippedCount > 0 && (
            <p className="text-sm text-gray-500">{t('common.inventory.import.complete.rowsSkipped', { count: skippedCount })}</p>
          )}
        </div>

        {/* Stats */}
        <div className="w-full grid grid-cols-3 gap-3">
          {[
            { label: t('common.inventory.import.complete.created'), value: newCount, color: 'text-green-700 bg-green-50' },
            { label: t('common.inventory.import.complete.updated'), value: updateCount, color: 'text-blue-700 bg-blue-50' },
            { label: t('common.inventory.import.complete.skipped'), value: skippedCount, color: 'text-gray-600 bg-gray-50' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onViewParts}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <Eye className="w-4 h-4" />
            {t('common.inventory.import.complete.viewImportedParts')}
          </button>
          <Link
            to="/app/inventory/import/history"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
          >
            <History className="w-4 h-4" />
            {t('common.inventory.import.complete.viewImportHistory')}
          </Link>
          <button
            onClick={() => setShowUndoModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            {t('common.inventory.import.complete.undoImport')}
            <span className="text-xs text-gray-400 ml-1">{t('common.inventory.import.complete.undoWithinHours')}</span>
          </button>
        </div>
      </div>

      {/* Undo confirmation modal */}
      {showUndoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{t('common.inventory.import.complete.undoModalTitle')}</h3>
            <p className="text-sm text-gray-600">
              {t('common.inventory.import.complete.undoModalBody')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUndoModal(false)}
                disabled={undoing}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                {t('common.inventory.import.complete.cancel')}
              </button>
              <button
                onClick={handleUndo}
                disabled={undoing}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {undoing ? t('common.inventory.import.complete.undoing') : t('common.inventory.import.complete.yesUndo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
