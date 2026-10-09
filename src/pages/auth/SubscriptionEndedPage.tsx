import { useNavigate } from 'react-router-dom';
import { CreditCard, LifeBuoy, LogOut, PauseCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logout } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import { isTrialExpired } from '../../lib/planLimits';

/**
 * Shown to every user of a company whose subscription has ended (company
 * status "suspended", set by the Stripe webhook when the paid period of a
 * cancelled or unpaid subscription is over). Nothing is deleted — only the
 * admin can still reach Billing & Plan to start a new subscription, or send
 * a request to the FirmiCore team (Lumora). Also covers a failed payment
 * (the company is paused automatically until it is paid) and an ended trial.
 */
export default function SubscriptionEndedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((state) => state.userProfile?.role === 'admin');
  const company = useAuthStore((state) => state.company);
  const companyName = company?.name;
  const reason = company?.suspendedReason ?? (isTrialExpired(company) ? 'trial_expired' : null);
  const paymentFailed = reason === 'payment_failed';
  const trialExpired = reason === 'trial_expired';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <PauseCircle className="w-8 h-8 text-amber-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {paymentFailed
              ? t('common.subscriptionEnded.paymentFailedTitle', { defaultValue: 'Payment failed' })
              : trialExpired
              ? t('common.subscriptionEnded.trialEndedTitle', { defaultValue: 'Free trial ended' })
              : t('common.subscriptionEnded.title')}
          </h2>
          {companyName && <p className="text-sm font-medium text-gray-500">{companyName}</p>}
          <p className="text-gray-600">
            {paymentFailed
              ? t('common.subscriptionEnded.paymentFailedBody', {
                  defaultValue: "We couldn't collect your company's latest FirmiCore payment, so access is paused for all users until it goes through. Your data has not been deleted and everything comes back as soon as the payment succeeds.",
                })
              : trialExpired
              ? t('common.subscriptionEnded.trialEndedBody', {
                  defaultValue: "Your company's free trial has ended, so access is paused for all users. Your data has not been deleted — everything is available again as soon as a plan is chosen.",
                })
              : t('common.subscriptionEnded.body')}
          </p>
          {paymentFailed && company?.paymentFailureMessage && (
            <p className="text-sm text-red-600">{company.paymentFailureMessage}</p>
          )}
          <p className="text-sm text-gray-500">
            {isAdmin
              ? paymentFailed
                ? t('common.subscriptionEnded.paymentFailedAdminHint', { defaultValue: 'As the company admin, update your card in Billing & Plan, or send a request to the FirmiCore team if you need help.' })
                : t('common.subscriptionEnded.adminHint')
              : t('common.subscriptionEnded.memberHint')}
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
          {isAdmin && (
            <button
              onClick={() => navigate('/app/support-requests')}
              className="w-full flex items-center justify-center gap-2 border border-blue-200 text-blue-700 font-medium py-2 rounded-lg hover:bg-blue-50 transition-colors h-11"
            >
              <LifeBuoy className="w-4 h-4" />
              {t('common.subscriptionEnded.contactSupport', { defaultValue: 'Send a request to FirmiCore' })}
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
