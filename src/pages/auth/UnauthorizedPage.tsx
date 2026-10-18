import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDashboardRoute } from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';

export default function UnauthorizedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userRole = useAuthStore((state) => state.userProfile?.role);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-[#0A1628] via-[#0C1B33] to-[#12335C] flex items-center justify-center p-4">
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#1A56DB]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-24 -right-20 h-80 w-80 rounded-full bg-[#00C2FF]/10 blur-3xl" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1B33]/90 shadow-2xl shadow-black/40 backdrop-blur p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-red-400" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white! mb-2">{t('common.auth.unauthorized.title')}</h2>
          <p className="text-slate-300">{t('common.auth.unauthorized.message')}</p>
        </div>

        <button
          onClick={() => {
            if (userRole) {
              navigate(getDashboardRoute(userRole));
            } else {
              navigate('/login');
            }
          }}
          className="w-full bg-gradient-to-r from-[#1A56DB] to-[#1D6FF2] hover:brightness-110 text-white font-semibold shadow-lg shadow-[#1A56DB]/30 py-2 rounded-xl transition-all h-11"
        >
          {t('common.auth.unauthorized.goToDashboard')}
        </button>
      </div>
    </div>
  );
}
