import { useState } from 'react';
import { Award, Download, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { downloadProgrammeCertificate } from '@/lib/traineeProgram/programmeCertificate';
import type { TraineeProgrammeCertificate } from '@/types/traineeProgram';

interface ProgrammeCertificateCardProps {
  certificate: TraineeProgrammeCertificate;
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// The completion certificate for a whole trainee programme (all months'
// modules, signed off by the recommending admin/plant manager/HR officer) —
// distinct from a single module's TrainingCertificate. Downloads re-render
// the PDF from the certificate record in the current design; the copy
// uploaded at sign-off is only a fallback if rendering fails.
export default function ProgrammeCertificateCard({ certificate }: ProgrammeCertificateCardProps) {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const [downloading, setDownloading] = useState(false);
  const issuedAt = certificate.issuedAt as unknown as { seconds: number };

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadProgrammeCertificate(certificate, company);
    } catch (err) {
      console.error('Failed to build programme certificate PDF', err);
      if (certificate.pdfUrl) window.open(certificate.pdfUrl, '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-600 px-4 py-3 flex items-center gap-2">
        <Award size={20} className="text-yellow-300" />
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          {t('common.traineeManagement.library.programmeCertificateCard.heading')}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">{t('common.traineeManagement.library.programmeCertificateCard.certificateNo')}</p>
          <p className="font-mono text-sm font-semibold text-slate-700">{certificate.certificateNumber}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">{t('common.traineeManagement.library.programmeCertificateCard.programme')}</p>
          <p className="font-bold text-blue-700 text-lg leading-tight">
            {t('common.traineeManagement.library.programmeCertificateCard.programmeTitle', { count: certificate.durationMonths })}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">{t('common.traineeManagement.library.programCertificateCard.modulesCompleted')}</p>
          <p className="text-sm text-slate-700 leading-snug">
            {t('common.traineeManagement.library.programmeCertificateCard.modulesCompleted', {
              count: certificate.moduleResults.length,
              months: certificate.durationMonths,
            })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{t('common.traineeManagement.library.programmeCertificateCard.issued', { date: formatDate(issuedAt) })}</span>
          </div>
        </div>

        <div className="text-xs text-slate-600">
          {t('common.traineeManagement.library.programmeCertificateCard.signedOffBy', {
            name: certificate.recommendedByName,
            role: certificate.recommendedByRole,
          })}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">
            {t('common.traineeManagement.library.programmeCertificateCard.finalMark', { mark: certificate.finalMark })}
          </span>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-60"
            aria-label={t('common.traineeManagement.library.programmeCertificateCard.downloadAria')}
          >
            <Download size={14} />
            {t('common.traineeManagement.library.programmeCertificateCard.downloadButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
