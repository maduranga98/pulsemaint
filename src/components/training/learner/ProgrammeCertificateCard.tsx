import { Award, Download, Calendar } from 'lucide-react';
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
// distinct from a single module's TrainingCertificate. The PDF is rendered
// and uploaded once at sign-off time (see issueProgrammeCertificate), with
// the signer's digital signature already embedded, so this just links to it.
export default function ProgrammeCertificateCard({ certificate }: ProgrammeCertificateCardProps) {
  const issuedAt = certificate.issuedAt as unknown as { seconds: number };

  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-600 px-4 py-3 flex items-center gap-2">
        <Award size={20} className="text-yellow-300" />
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          Programme Completion Certificate
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Certificate No.</p>
          <p className="font-mono text-sm font-semibold text-slate-700">{certificate.certificateNumber}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Programme</p>
          <p className="font-bold text-blue-700 text-lg leading-tight">
            {certificate.durationMonths}-Month Trainee Programme
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Modules Completed</p>
          <p className="text-sm text-slate-700 leading-snug">
            {certificate.moduleResults.length} module{certificate.moduleResults.length === 1 ? '' : 's'} across {certificate.durationMonths} months
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>Issued {formatDate(issuedAt)}</span>
          </div>
        </div>

        <div className="text-xs text-slate-600">
          Signed off by <strong className="text-slate-700">{certificate.recommendedByName}</strong> ({certificate.recommendedByRole})
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">
            Final Mark: <strong className="text-slate-700">{certificate.finalMark}%</strong>
          </span>
          <a
            href={certificate.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            aria-label="Download programme certificate PDF"
          >
            <Download size={14} />
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}
