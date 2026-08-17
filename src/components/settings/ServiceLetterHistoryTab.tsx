import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { Download, FileText } from 'lucide-react';
import { db } from '@/lib/firebase';

interface ServiceLetterHistoryEntry {
  id: string;
  issuedAt: Timestamp | null;
  subject: string;
  toName: string;
  toRole: string;
  byName: string;
  byRole: string;
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toCsv(rows: ServiceLetterHistoryEntry[]): string {
  const header = ['Issued Date', 'Subject', 'Issued To', 'To Role', 'Issued By', 'By Role'];
  const lines = rows.map((r) =>
    [formatDate(r.issuedAt), r.subject, r.toName, r.toRole, r.byName, r.byRole]
      .map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export function ServiceLetterHistoryTab({ companyId }: { companyId: string }) {
  const [entries, setEntries] = useState<ServiceLetterHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, 'serviceLetterHistory'),
      where('companyId', '==', companyId),
      orderBy('issuedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceLetterHistoryEntry));
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load service letter history', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  function handleExport() {
    const csv = toCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Service-Letter-History-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-white rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-red-100">
        <FileText className="w-8 h-8 text-red-300 mx-auto mb-2" />
        <p className="text-sm text-red-500">Couldn't load service letter history.</p>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No service letters generated yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Issued Date</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Issued To</th>
              <th className="px-4 py-3 text-left">Issued By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.issuedAt)}</td>
                <td className="px-4 py-3 text-slate-800">{e.subject}</td>
                <td className="px-4 py-3">
                  <span className="text-slate-800">{e.toName}</span>
                  <span className="text-slate-400"> — {e.toRole}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-800">{e.byName}</span>
                  <span className="text-slate-400"> — {e.byRole}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
