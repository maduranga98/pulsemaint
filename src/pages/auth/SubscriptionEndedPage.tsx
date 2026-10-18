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
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-[#0A1628] via-[#0C1B33] to-[#12335C] flex items-center justify-center p-4">
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#1A56DB]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-24 -right-20 h-80 w-80 rounded-full bg-[#00C2FF]/10 blur-3xl" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1B33]/90 shadow-2xl shadow-black/40 backdrop-blur p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto">
          <PauseCircle className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white!">
            {paymentFailed
              ? t('common.subscriptionEnded.paymentFailedTitle', { defaultValue: 'Payment failed' })
              : trialExpired
              ? t('common.subscriptionEnded.trialEndedTitle', { defaultValue: 'Free trial ended' })
              : t('common.subscriptionEnded.title')}
          </h2>
          {companyName && <p className="text-sm font-medium text-slate-400">{companyName}</p>}
          <p className="text-slate-300">
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
            <p className="text-sm text-red-400">{company.paymentFailureMessage}</p>
          )}
          <p className="text-sm text-slate-400">
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
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#1A56DB] to-[#1D6FF2] hover:brightness-110 text-white font-semibold shadow-lg shadow-[#1A56DB]/30 py-2 rounded-xl transition-all h-11"
            >
              <CreditCard className="w-4 h-4" />
              {t('common.subscriptionEnded.renew')}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate('/app/support-requests')}
              className="w-full flex items-center justify-center gap-2 border border-[#00C2FF]/30 text-[#00C2FF] font-medium py-2 rounded-xl hover:bg-[#00C2FF]/10 transition-colors h-11"
            >
              <LifeBuoy className="w-4 h-4" />
              {t('common.subscriptionEnded.contactSupport', { defaultValue: 'Send a request to FirmiCore' })}
            </button>
          )}
          <button
            onClick={() => void logout().then(() => navigate('/login'))}
            className="w-full flex items-center justify-center gap-2 border border-white/10 bg-[#0B1526] text-slate-100 font-medium py-2 rounded-xl hover:bg-white/5 transition-colors h-11"
          >
            <LogOut className="w-4 h-4" />
            {t('common.subscriptionEnded.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
