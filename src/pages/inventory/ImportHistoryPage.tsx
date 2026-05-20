import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useImportHistory } from '@/hooks/inventory/useImportHistory';
import { useToast } from '@/hooks/useToast';
import { ImportHistoryTable } from '@/components/inventory/import/ImportHistoryTable';

export function ImportHistoryPage() {
  const { addToast } = useToast();
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const { sessions, loading, error } = useImportHistory();

  async function handleReverse(sessionId: string) {
    try {
      await updateDoc(doc(db, 'inventoryImportSessions', sessionId), {
        status: 'reversed',
        reversedAt: serverTimestamp(),
        reversedBy: userId,
      });
      addToast('Import reversed successfully.', 'success');
    } catch (err) {
      addToast('Failed to reverse import.', 'error');
      console.error(err);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/app/inventory/import" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Import History</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <ImportHistoryTable sessions={sessions} onReverseImport={handleReverse} />
      )}
    </div>
  );
}
export default ImportHistoryPage;
