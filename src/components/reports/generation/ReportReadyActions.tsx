import { Download, ExternalLink } from 'lucide-react';

export default function ReportReadyActions({
  downloadUrl,
  sheetsUrl,
}: {
  downloadUrl: string | null;
  sheetsUrl: string | null;
}) {
  if (!downloadUrl && !sheetsUrl) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {downloadUrl && (
        <a href={downloadUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#10B981] px-4 text-sm font-semibold text-white">
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      )}
      {sheetsUrl && (
        <a href={sheetsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1A56DB] px-4 text-sm font-semibold text-white">
          <ExternalLink className="h-4 w-4" />
          Open in Sheets
        </a>
      )}
    </div>
  );
}
