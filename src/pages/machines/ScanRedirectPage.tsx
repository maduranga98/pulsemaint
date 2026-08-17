import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { savePendingScanMachineId, savePostLoginRedirect } from '../../lib/scanTarget';
import { useAuthStore } from '../../store/authStore';

export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const machineId = searchParams.get('machineId');
  const siteId = searchParams.get('siteId');
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    // Wait for Firebase auth to resolve before deciding where to send the
    // scanner — otherwise a signed-in technician would briefly get routed to
    // the public form before their session is known.
    if (!isInitialized) return;

    if (!user) {
      // No account signed in (the common case for a floor QR scan) — go
      // straight to the public, no-login breakdown form instead of the
      // protected in-app page, which would otherwise dead-end at /login.
      const query = new URLSearchParams();
      if (machineId) query.set('machineId', machineId);
      if (siteId) query.set('siteId', siteId);
      navigate(`/report-breakdown${query.toString() ? `?${query}` : ''}`, { replace: true });
      return;
    }

    if (machineId) {
      // Persist the scan so the machine still auto-selects even if the user
      // has to log in first (router state is lost on page reloads).
      savePendingScanMachineId(machineId);
      savePostLoginRedirect(`/app/breakdowns/report?machineId=${machineId}`);
      navigate(`/app/breakdowns/report?machineId=${machineId}`, { replace: true });
    } else {
      navigate('/app/breakdowns/report', { replace: true });
    }
  }, [machineId, siteId, user, isInitialized, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Redirecting to breakdown report...</p>
    </div>
  );
}
