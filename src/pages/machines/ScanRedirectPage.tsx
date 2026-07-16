import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { savePendingScanMachineId, savePostLoginRedirect } from '../../lib/scanTarget';

export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const machineId = searchParams.get('machineId');

  useEffect(() => {
    if (machineId) {
      // Persist the scan so the machine still auto-selects even if the user
      // has to log in first (router state is lost on page reloads).
      savePendingScanMachineId(machineId);
      savePostLoginRedirect(`/app/breakdowns/report?machineId=${machineId}`);
      navigate(`/app/breakdowns/report?machineId=${machineId}`, { replace: true });
    } else {
      navigate('/app/breakdowns/report', { replace: true });
    }
  }, [machineId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Redirecting to breakdown report...</p>
    </div>
  );
}
