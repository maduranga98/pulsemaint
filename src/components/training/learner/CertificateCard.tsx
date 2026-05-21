import { Award, Download, Calendar } from 'lucide-react';
import type { TrainingCertificate } from '@/lib/training/trainingTypes';

interface CertificateCardProps {
  certificate: TrainingCertificate;
}

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isExpiringSoon(ts: { seconds: number } | null): boolean {
  if (!ts) return false;
  const diff = ts.seconds * 1000 - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

export default function CertificateCard({ certificate }: CertificateCardProps) {
  const expiry = certificate.expiryDate as unknown as { seconds: number } | null;
  const issuedAt = certificate.issuedAt as unknown as { seconds: number };
  const expiringSoon = isExpiringSoon(expiry);

  return (
    <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Revoked overlay */}
      {certificate.isRevoked && (
        <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-10 rounded-2xl">
          <span className="text-white font-bold text-2xl tracking-widest rotate-[-15deg] border-4 border-white px-4 py-2 rounded">
            REVOKED
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-4 py-3 flex items-center gap-2">
        <Award size={20} className="text-yellow-300" />
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          Training Certificate
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Certificate No.</p>
          <p className="font-mono text-sm font-semibold text-slate-700">
            {certificate.certificateNumber}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Machine</p>
          <p className="font-bold text-green-700 text-lg leading-tight">
            {certificate.machineName}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Module</p>
          <p className="text-sm text-slate-700 leading-snug">{certificate.moduleName}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>Issued {formatDate(issuedAt)}</span>
          </div>
          {expiry && (
            <div
              className={`flex items-center gap-1 ${
                certificate.isExpired
                  ? 'text-red-600 font-semibold'
                  : expiringSoon
                  ? 'text-amber-600 font-semibold'
                  : ''
              }`}
            >
              <Calendar size={12} />
              <span>
                {certificate.isExpired ? 'Expired' : 'Expires'} {formatDate(expiry)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">
            Score: <strong className="text-slate-700">{certificate.quizScore}%</strong>
          </span>
          {certificate.pdfUrl && !certificate.isRevoked && (
            <a
              href={certificate.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              aria-label="Download certificate PDF"
            >
              <Download size={14} />
              Download PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
