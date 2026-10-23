import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

interface RetentionStatus {
  noticeActive?: boolean;
  pendingCount?: number;
}

/**
 * Admin-only: finished records older than a year are deleted only after the
 * company data has been exported. While some are waiting, this reminds the
 * admin to export; a successful export (server-side) clears the flag and the
 * banner disappears.
 */
export default function RetentionExportBanner() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.userProfile?.role);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [status, setStatus] = useState<RetentionStatus | null>(null);

  useEffect(() => {
    if (role !== 'admin' || !companyId) {
      setStatus(null);
      return;
    }
    return onSnapshot(
      doc(db, 'retentionStatus', companyId),
      (snap) => setStatus(snap.exists() ? (snap.data() as RetentionStatus) : null),
      () => setStatus(null),
    );
  }, [role, companyId]);

  if (!status?.noticeActive) return null;
  const count = status.pendingCount ?? 0;
  return (
    <div className="px-4 py-2 text-sm text-center flex items-center justify-center gap-3 bg-amber-900/70 text-amber-100">
      <span>
        {t(
          'common.retention.exportBanner',
          '{{count}}+ records are older than a year. Export your data now — expired data is deleted only after you export it.',
          { count },
        )}
      </span>
      <Link to="/app/settings" className="font-semibold underline underline-offset-2 hover:no-underline text-amber-200">
        {t('common.retention.exportNow', 'Export data')}
      </Link>
    </div>
  );
}
