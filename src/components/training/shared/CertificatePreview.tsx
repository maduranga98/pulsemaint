import { Award, Download, Calendar } from 'lucide-react';
import type { TrainingCertificate } from '@/lib/training/trainingTypes';

interface CertificatePreviewProps {
  certificate: TrainingCertificate;
}

function formatDate(timestamp: { seconds: number } | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp.seconds * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function CertificatePreview({ certificate }: CertificatePreviewProps) {
  return (
    <div className="border-2 border-amber-300 rounded-2xl overflow-hidden shadow-md max-w-md w-full">
      {/* Header gradient */}
      <div className="bg-gradient-to-r from-amber-400 to-green-500 px-6 py-4 flex items-center gap-3">
        <Award className="text-white shrink-0" size={28} aria-hidden="true" />
        <div>
          <p className="text-xs font-bold tracking-widest text-white/80 uppercase">
            Training Certificate
          </p>
          <p className="text-xs text-white/70">{certificate.certificateNumber}</p>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white px-6 py-5 space-y-4">
        {/* Trainee name */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Awarded to</p>
          <p className="text-2xl font-bold text-slate-900 font-sans">{certificate.traineeName}</p>
        </div>

        {/* Module & Machine */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">{certificate.moduleName}</p>
          <p className="text-sm text-slate-500">Machine: {certificate.machineName}</p>
        </div>

        {/* Dates */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar size={14} aria-hidden="true" />
            <span>Issued: {formatDate(certificate.issuedAt as unknown as { seconds: number })}</span>
          </div>
          {certificate.expiryDate && (
            <div
              className={`flex items-center gap-1.5 ${
                certificate.isExpired ? 'text-red-600' : 'text-slate-600'
              }`}
            >
              <Calendar size={14} aria-hidden="true" />
              <span>
                Expires:{' '}
                {formatDate(certificate.expiryDate as unknown as { seconds: number })}
                {certificate.isExpired && ' (Expired)'}
              </span>
            </div>
          )}
        </div>

        {/* Issued by */}
        <p className="text-xs text-slate-500">Issued by: {certificate.issuedByName}</p>

        {/* Download button */}
        {certificate.pdfUrl && (
          <a
            href={certificate.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            aria-label="Download certificate PDF"
          >
            <Download size={14} aria-hidden="true" />
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}
