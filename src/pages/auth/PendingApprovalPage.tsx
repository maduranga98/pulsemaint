import { Navigate, useNavigate } from 'react-router-dom';
import { Clock, LogOut, Mail, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDashboardRoute, logout } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import { companyApproval } from '../../lib/companyApproval';
import LanguageSwitcher from '../../components/layout/LanguageSwitcher';

/**
 * Shown to users of a self-registered company until a Lumora superadmin
 * approves it (or after it was declined). The company document is
 * listened to live, so approval lets them straight in without a reload.
 */
export default function PendingApprovalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const company = useAuthStore((state) => state.company);
  const profile = useAuthStore((state) => state.userProfile);
  const approval = companyApproval(company?.approvalStatus);

  if (company && approval === 'approved') {
    const to = profile?.role === 'admin' && !company.onboardingCompletedAt
      ? '/app/onboarding'
      : profile?.role ? getDashboardRoute(profile.role) : '/app/dashboard';
    return <Navigate to={to} replace />;
  }

  const rejected = approval === 'rejected';

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#0A1628] via-[#0C1B33] to-[#12335C] flex items-center justify-center px-4 py-10">
      <div className="pointer-events-none fixed -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#1A56DB]/20 blur-3xl" />
      <div className="pointer-events-none fixed top-1/4 -right-16 h-80 w-80 rounded-full bg-[#00C2FF]/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="FirmiCore" className="h-9 w-auto" />
            <span className="text-xl font-bold"><span className="text-white">Firmi</span><span className="text-[#00C2FF]">Core</span></span>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#0D1B33]/90 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${rejected ? 'bg-red-500/15' : 'bg-[#00C2FF]/15'}`}>
            {rejected ? <XCircle className="h-8 w-8 text-red-400" /> : <Clock className="h-8 w-8 text-[#00C2FF]" />}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl" style={{ color: '#ffffff', fontWeight: 700 }}>
              {rejected ? t('common.pendingApproval.rejectedTitle') : t('common.pendingApproval.title')}
            </h1>
            {company?.name && <p className="text-sm font-medium text-slate-300">{company.name}</p>}
            <p className="text-sm leading-relaxed text-slate-300">
              {rejected ? t('common.pendingApproval.rejectedBody') : t('common.pendingApproval.body')}
            </p>
            {rejected && company?.rejectionReason && (
              <p className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-left text-sm text-red-200">
                {t('common.pendingApproval.reason')}: {company.rejectionReason}
              </p>
            )}
            {!rejected && (
              <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Mail className="h-3.5 w-3.5" />
                {t('common.pendingApproval.emailHint', { email: profile?.email ?? '' })}
              </p>
            )}
          </div>
          <button
            onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0B1526] font-medium text-slate-100 transition-colors hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            {t('common.pendingApproval.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
