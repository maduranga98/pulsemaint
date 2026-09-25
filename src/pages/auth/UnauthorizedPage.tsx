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
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-red-600" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('common.auth.unauthorized.title')}</h2>
          <p className="text-gray-600">{t('common.auth.unauthorized.message')}</p>
        </div>

        <button
          onClick={() => {
            if (userRole) {
              navigate(getDashboardRoute(userRole));
            } else {
              navigate('/login');
            }
          }}
          className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors h-11"
        >
          {t('common.auth.unauthorized.goToDashboard')}
        </button>
      </div>
    </div>
  );
}
