import { useNavigate } from 'react-router-dom';
import { CreditCard, LogOut, PauseCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logout } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';

/**
 * Shown to every user of a company whose subscription has ended (company
 * status "suspended", set by the Stripe webhook when the paid period of a
 * cancelled or unpaid subscription is over). Nothing is deleted — only the
 * admin can still reach Billing & Plan to start a new subscription.
 */
export default function SubscriptionEndedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((state) => state.userProfile?.role === 'admin');
  const companyName = useAuthStore((state) => state.company?.name);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <PauseCircle className="w-8 h-8 text-amber-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">{t('common.subscriptionEnded.title')}</h2>
          {companyName && <p className="text-sm font-medium text-gray-500">{companyName}</p>}
          <p className="text-gray-600">{t('common.subscriptionEnded.body')}</p>
          <p className="text-sm text-gray-500">
            {isAdmin ? t('common.subscriptionEnded.adminHint') : t('common.subscriptionEnded.memberHint')}
          </p>
        </div>

        <div className="space-y-3">
          {isAdmin && (
            <button
              onClick={() => navigate('/app/billing')}
              className="w-full flex items-center justify-center gap-2 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors h-11"
            >
              <CreditCard className="w-4 h-4" />
              {t('common.subscriptionEnded.renew')}
            </button>
          )}
          <button
            onClick={() => void logout().then(() => navigate('/login'))}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors h-11"
          >
            <LogOut className="w-4 h-4" />
            {t('common.subscriptionEnded.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
