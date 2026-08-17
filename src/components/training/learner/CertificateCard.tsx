import { useTranslation } from 'react-i18next';
import { Award, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { buildTrainingCertificatePdf, certificateFileName } from '@/lib/training/certificatePdf';
import type { TrainingCertificate } from '@/lib/training/trainingTypes';
import { resolveCompanyLogoDataUrl } from '@/lib/pdf/logoUtils';

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
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const expiry = certificate.expiryDate as unknown as { seconds: number } | null;
  const issuedAt = certificate.issuedAt as unknown as { seconds: number };
  const expiringSoon = isExpiringSoon(expiry);
  const isExternal = certificate.moduleCategory === 'offboard_external';

  // Rendered on demand from the company's letterhead rather than fetched —
  // there is no stored PDF for a certificate issued in-app.
  async function handleDownload() {
    try {
      const companyLogoDataUrl = await resolveCompanyLogoDataUrl(company);
      const doc = buildTrainingCertificatePdf({
        certificateNumber: certificate.certificateNumber,
        traineeName: certificate.traineeName,
        traineeDesignation: certificate.traineeDesignation || null,
        moduleName: certificate.moduleName,
        subjectLabel: isExternal ? t('common.training.certificateCard.providerLabel') : t('common.training.certificateCard.machineLabel'),
        subjectValue: isExternal ? certificate.providerName || t('common.training.certificateCard.external') : certificate.machineName,
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
        companyLogoDataUrl,
      });
      doc.save(certificateFileName(certificate.traineeName, certificate.certificateNumber));
    } catch (err) {
      console.error('Failed to build certificate PDF', err);
      toast.error(t('common.training.certificateCard.toastGenerateError'));
    }
  }

  return (
    <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Revoked overlay */}
      {certificate.isRevoked && (
        <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-10 rounded-2xl">
          <span className="text-white font-bold text-2xl tracking-widest rotate-[-15deg] border-4 border-white px-4 py-2 rounded">
            {t('common.training.certificateCard.revoked')}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-4 py-3 flex items-center gap-2">
        <Award size={20} className="text-yellow-300" />
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          {t('common.training.certificateCard.headerTitle')}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">{t('common.training.certificateCard.certificateNoLabel')}</p>
          <p className="font-mono text-sm font-semibold text-slate-700">
            {certificate.certificateNumber}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">
            {certificate.moduleCategory === 'offboard_external' ? t('common.training.certificateCard.providerLabel') : t('common.training.certificateCard.machineLabel')}
          </p>
          <p className="font-bold text-green-700 text-lg leading-tight">
            {certificate.moduleCategory === 'offboard_external'
              ? certificate.providerName || t('common.training.certificateCard.external')
              : certificate.machineName}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">{t('common.training.certificateCard.moduleLabel')}</p>
          <p className="text-sm text-slate-700 leading-snug">{certificate.moduleName}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{t('common.training.certificateCard.issued', { date: formatDate(issuedAt) })}</span>
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
                {certificate.isExpired
                  ? t('common.training.certificateCard.expired', { date: formatDate(expiry) })
                  : t('common.training.certificateCard.expires', { date: formatDate(expiry) })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">
            {t('common.training.certificateCard.scoreLabel', { score: certificate.quizScore })}
          </span>
          {!certificate.isRevoked && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              aria-label={t('common.training.certificateCard.ariaDownload')}
            >
              <Download size={14} />
              {t('common.training.certificateCard.downloadA4')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
