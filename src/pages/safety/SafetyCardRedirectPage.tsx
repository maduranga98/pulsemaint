import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { savePostLoginRedirect } from '@/lib/scanTarget';
import { parseSafetyCardScan } from '@/lib/safety/contractorSafety';

/**
 * Landing page for a Contractor Safety Card's QR code (/safety-card?id=…),
 * reached by scanning it with the phone camera. Signed-in staff go straight
 * to the Safety Cases report form for the holder; anyone else signs in first
 * and is sent on afterwards.
 */
export default function SafetyCardRedirectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const cardId = parseSafetyCardScan(`${window.location.origin}/safety-card?id=${searchParams.get('id') ?? ''}`);

  useEffect(() => {
    if (!isInitialized) return;
    const target = cardId ? `/app/safety/cases?card=${encodeURIComponent(cardId)}` : '/app/safety/cases';
    if (!user) {
      // Router state is lost on a full reload (e.g. Google sign-in redirect),
      // so the destination is also kept in sessionStorage.
      savePostLoginRedirect(target);
      navigate('/login', { replace: true, state: { from: target } });
      return;
    }
    navigate(target, { replace: true });
  }, [cardId, user, isInitialized, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">{t('common.safetyCases.scan.redirecting')}</p>
    </div>
  );
}
