import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Download, Loader2, PackageOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db, functions } from '@/lib/firebase';
import { useToast } from '@/hooks/useToast';
import type { CompanyProfile } from '@/types/auth';

interface ExportJob {
  id: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  progress?: { step?: string; collection?: string; records?: number; done?: number; total?: number };
  downloadUrl?: string;
  expiresAt?: Timestamp;
  sizeBytes?: number;
  counts?: { records: number; files: number; missing: number; refused: number };
  error?: string;
  failedStep?: string;
  errorDetail?: string;
  createdAt?: Timestamp;
}

const requestExport = httpsCallable<unknown, { id: string }>(functions, 'requestCompanyExport');

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  return bytes > 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

/**
 * Admin-only "Export all data": asks the server for a ZIP of every record and
 * attachment of the company (work orders, breakdowns, contractors, machines, PM,
 * safety, inventory, purchase orders, audits, evaluations) with an offline
 * index.html viewer. The job runs in the background; the link lasts 24 hours.
 */
export function ExportDataCard({ company }: { company: CompanyProfile }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [job, setJob] = useState<ExportJob | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'exports'), where('companyId', '==', company.id), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, (snap) => {
      const d = snap.docs[0];
      setJob(d ? ({ id: d.id, ...d.data() } as ExportJob) : null);
    }, () => setJob(null));
  }, [company.id]);

  const busy = job?.status === 'queued' || job?.status === 'running';
  const expired = job?.status === 'ready' && job.expiresAt ? job.expiresAt.toMillis() < Date.now() : false;

  async function start() {
    setStarting(true);
    try {
      await requestExport({});
      toast.success(t('common.settings.export.started', 'Export started. This can take several minutes.'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.settings.export.failedToStart', 'Could not start the export.'));
    } finally {
      setStarting(false);
    }
  }

  let status: string | null = null;
  if (busy) {
    const p = job?.progress;
    status = p?.step === 'packing' && p.total
      ? t('common.settings.export.packing', 'Packing files… {{done}} of {{total}}', { done: p.done ?? 0, total: p.total })
      : t('common.settings.export.collecting', 'Collecting records… {{count}} so far', { count: p?.records ?? 0 });
  } else if (job?.status === 'failed') {
    status = `${job.error ?? t('common.settings.export.failed', 'The last export failed.')}${job.failedStep ? ` (${job.failedStep}${job.errorDetail ? `: ${job.errorDetail}` : ''})` : ''}`;
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <PackageOpen className="w-5 h-5 mt-0.5 text-slate-500" />
          <div>
            <h2 className="font-semibold text-slate-900">{t('common.settings.export.title', 'Export all data')}</h2>
            <p className="text-sm text-slate-500 mt-0.5 max-w-xl">
              {t('common.settings.export.description', 'Download one ZIP with every work order, breakdown, contractor, machine, PM schedule, safety case, inventory item, purchase order, audit and evaluation, together with their attachments. Unzip it and open index.html to browse everything offline. The download link lasts 24 hours.')}
            </p>
            {status && <p className={`text-sm mt-2 ${job?.status === 'failed' ? 'text-red-600' : 'text-slate-600'}`}>{status}</p>}
            {job?.status === 'ready' && !expired && job.downloadUrl && (
              <p className="text-sm mt-2 text-slate-600">
                {t('common.settings.export.ready', 'Ready')}
                {job.sizeBytes ? ` · ${formatSize(job.sizeBytes)}` : ''}
                {job.counts ? ` · ${job.counts.records} records, ${job.counts.files} files` : ''}
                {job.counts?.missing ? ` · ${job.counts.missing} unreadable (see _export-notes.txt)` : ''}
              </p>
            )}
            {expired && <p className="text-sm mt-2 text-slate-500">{t('common.settings.export.expired', 'The last download link has expired — start a new export.')}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {job?.status === 'ready' && !expired && job.downloadUrl && (
            <a href={job.downloadUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Download className="w-4 h-4" /> {t('common.settings.export.download', 'Download ZIP')}
            </a>
          )}
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy || starting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {(busy || starting) && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.settings.export.start', 'Prepare new export')}
          </button>
        </div>
      </div>
    </section>
  );
}
