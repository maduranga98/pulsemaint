import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePendingHandover } from '@/hooks/usePendingHandover';
import ShiftBriefingScreen from '@/components/handover/ShiftBriefingScreen';

export function ShiftBriefingPage() {
  const { t } = useTranslation();
  const { pendingHandover } = usePendingHandover();

  if (!pendingHandover) {
    return (
      <div className="p-4 lg:p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          {t('common.shiftHandovers.briefingPage.noPending')}
          <Link to="/app/dashboard" className="ml-2 font-semibold text-blue-700">{t('common.shiftHandovers.briefingPage.returnToDashboard')}</Link>
        </div>
      </div>
    );
  }

  return <ShiftBriefingScreen handover={pendingHandover} />;
}

export default ShiftBriefingPage;
