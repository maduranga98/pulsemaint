import { Award, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { buildTrainingCertificatePdf, certificateFileName } from '@/lib/training/certificatePdf';
import type { TrainingCertificate } from '@/lib/training/trainingTypes';

interface CertificateCardProps {
  certificate: TrainingCertificate;
}

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return '';
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
  const company = useAuthStore((s) => s.company);
  const expiry = certificate.expiryDate as unknown as { seconds: number } | null;
  const issuedAt = certificate.issuedAt as unknown as { seconds: number };
  const expiringSoon = isExpiringSoon(expiry);
  const isExternal = certificate.moduleCategory === 'offboard_external';

  // Rendered on demand from the company's letterhead rather than fetched —
  // there is no stored PDF for a certificate issued in-app.
  function handleDownload() {
    try {
      const doc = buildTrainingCertificatePdf({
        certificateNumber: certificate.certificateNumber,
        traineeName: certificate.traineeName,
        traineeDesignation: certificate.traineeDesignation || null,
        moduleName: certificate.moduleName,
        subjectLabel: isExternal ? 'Provider' : 'Machine',
        subjectValue: isExternal ? certificate.providerName || 'External' : certificate.machineName,
        quizScore: certificate.quizScore ?? 0,
        issuedAt: issuedAt ? new Date(issuedAt.seconds * 1000) : new Date(),
        expiryDate: expiry ? new Date(expiry.seconds * 1000) : null,
        issuedByName: certificate.issuedByName || '',
        practicalObservations: certificate.practicalObservations || null,
        companyName: company?.name || certificate.companyName || '',
        companyDescription: company?.description ?? null,
        companyAddress: company?.address ?? null,
        companyPhone: company?.phone ?? null,
        companyEmail: company?.email ?? null,
        companyLogoDataUrl: company?.logoDataUrl ?? null,
      });
      doc.save(certificateFileName(certificate.traineeName, certificate.certificateNumber));
    } catch (err) {
      console.error('Failed to build certificate PDF', err);
      toast.error('Could not generate the certificate PDF.');
    }
  }

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
          <p className="text-xs text-slate-500">
            {certificate.moduleCategory === 'offboard_external' ? 'Provider' : 'Machine'}
          </p>
          <p className="font-bold text-green-700 text-lg leading-tight">
            {certificate.moduleCategory === 'offboard_external'
              ? certificate.providerName || 'External'
              : certificate.machineName}
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
          {!certificate.isRevoked && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              aria-label="Download certificate as an A4 PDF"
            >
              <Download size={14} />
              Download A4 PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
