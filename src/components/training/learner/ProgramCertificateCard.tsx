import { Award, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { buildProgramCertificatePdf, buildProgramCertificateNumber, programCertificateFileName } from '@/lib/training/programCertificatePdf';
import { resolveCompanyLogoDataUrl } from '@/lib/pdf/logoUtils';
import type { ProgramAssignment } from '@/types/trainingProgram';

interface ProgramCertificateCardProps {
  programAssignment: ProgramAssignment;
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Completion certificate for an assigned training program (`programAssignments`,
 * signed off in Trainee Management → Assigned) — rendered client-side on
 * demand, same as the module certificate, with the signing-off manager's
 * captured digital signature already embedded.
 */
export default function ProgramCertificateCard({ programAssignment: pa }: ProgramCertificateCardProps) {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const cert = pa.certificate;
  const issuedAt = cert?.issuedAt as unknown as { seconds: number } | undefined;

  async function handleDownload() {
    if (!cert) return;
    try {
      // Certificates signed off before this field existed have no stored
      // number — mint one for this download rather than crash or print
      // "undefined" on the certificate.
      const certificateNumber = cert.certificateNumber || buildProgramCertificateNumber();
      const companyLogoDataUrl = await resolveCompanyLogoDataUrl(company);
      const doc = buildProgramCertificatePdf({
        certificateNumber,
        companyName: company?.name || '',
        companyDescription: company?.description ?? null,
        companyAddress: company?.address ?? null,
        companyPhone: company?.phone ?? null,
        companyEmail: company?.email ?? null,
        companyLogoDataUrl,
        traineeName: pa.traineeName,
        programName: pa.programName,
        issuedAt: issuedAt ? new Date(issuedAt.seconds * 1000) : new Date(),
        moduleResults: cert.moduleResults,
        note: pa.signOff?.note ?? null,
        signedOffByName: pa.signOff?.signedOffByName || '',
        signedOffByRole: pa.signOff?.signedOffByRole || '',
        signatureImageDataUrl: cert.signatureImageDataUrl ?? null,
      });
      doc.save(programCertificateFileName(pa.traineeName, certificateNumber));
    } catch (err) {
      console.error('Failed to build program certificate PDF', err);
      toast.error(t('common.traineeManagement.library.programCertificateCard.toasts.pdfFailed'));
    }
  }

  if (!cert) return null;

  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-600 px-4 py-3 flex items-center gap-2">
        <Award size={20} className="text-yellow-300" />
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          {t('common.traineeManagement.library.programCertificateCard.heading')}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">{t('common.traineeManagement.library.programCertificateCard.certificateNo')}</p>
          <p className="font-mono text-sm font-semibold text-slate-700">{cert.certificateNumber || t('common.traineeManagement.library.programCertificateCard.notAvailable')}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">{t('common.traineeManagement.library.programCertificateCard.program')}</p>
          <p className="font-bold text-blue-700 text-lg leading-tight">{pa.programName}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">{t('common.traineeManagement.library.programCertificateCard.modulesCompleted')}</p>
          <p className="text-sm text-slate-700 leading-snug">
            {t('common.traineeManagement.library.programCertificateCard.modulesCompleted', { count: cert.moduleResults.length })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{t('common.traineeManagement.library.programCertificateCard.issued', { date: formatDate(issuedAt) })}</span>
          </div>
        </div>

        {pa.signOff && (
          <div className="text-xs text-slate-600">
            {t('common.traineeManagement.library.programCertificateCard.signedOffBy', {
              name: pa.signOff.signedOffByName,
              role: pa.signOff.signedOffByRole.replace(/_/g, ' '),
            })}
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            aria-label={t('common.traineeManagement.library.programCertificateCard.downloadAria')}
          >
            <Download size={14} />
            {t('common.traineeManagement.library.programCertificateCard.downloadButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
