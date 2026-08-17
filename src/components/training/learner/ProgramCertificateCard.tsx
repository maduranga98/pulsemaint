import { Award, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { buildProgramCertificatePdf, programCertificateFileName } from '@/lib/training/programCertificatePdf';
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
  const company = useAuthStore((s) => s.company);
  const cert = pa.certificate;
  const issuedAt = cert?.issuedAt as unknown as { seconds: number } | undefined;

  async function handleDownload() {
    if (!cert) return;
    try {
      const companyLogoDataUrl = await resolveCompanyLogoDataUrl(company);
      const doc = buildProgramCertificatePdf({
        certificateNumber: cert.certificateNumber,
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
      doc.save(programCertificateFileName(pa.traineeName, cert.certificateNumber));
    } catch (err) {
      console.error('Failed to build program certificate PDF', err);
      toast.error('Could not generate the certificate PDF.');
    }
  }

  if (!cert) return null;

  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-600 px-4 py-3 flex items-center gap-2">
        <Award size={20} className="text-yellow-300" />
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          Program Completion Certificate
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Certificate No.</p>
          <p className="font-mono text-sm font-semibold text-slate-700">{cert.certificateNumber}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Program</p>
          <p className="font-bold text-blue-700 text-lg leading-tight">{pa.programName}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Modules Completed</p>
          <p className="text-sm text-slate-700 leading-snug">
            {cert.moduleResults.length} module{cert.moduleResults.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>Issued {formatDate(issuedAt)}</span>
          </div>
        </div>

        {pa.signOff && (
          <div className="text-xs text-slate-600">
            Signed off by <strong className="text-slate-700">{pa.signOff.signedOffByName}</strong>{' '}
            ({pa.signOff.signedOffByRole.replace(/_/g, ' ')})
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            aria-label="Download program certificate as an A4 PDF"
          >
            <Download size={14} />
            Download A4 PDF
          </button>
        </div>
      </div>
    </div>
  );
}
