import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ContractorAlertBannerProps {
  blockedCount?: number;
  expiringCount?: number;
  documentName?: string;
}

export function ContractorAlertBanner({ blockedCount = 0, expiringCount = 0, documentName }: ContractorAlertBannerProps) {
  if (!blockedCount && !expiringCount && !documentName) return null;

  const blocked = blockedCount > 0 || Boolean(documentName);

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${blocked ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {blocked
              ? documentName
                ? `Job assignment blocked - ${documentName} expired. Renew to assign jobs.`
                : `${blockedCount} contractors with expired documents - job assignment blocked.`
              : `${expiringCount} contractor documents expiring within 30 days.`}
          </p>
        </div>
        <Link to="/app/contractors/compliance" className="shrink-0 font-semibold underline">
          Compliance
        </Link>
      </div>
    </div>
  );
}

export default ContractorAlertBanner;
