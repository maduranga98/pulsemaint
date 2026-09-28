import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { platformService, errorText } from '@/services/platformService';
import { useSuperadmin } from '@/lib/platform/useSuperadmin';

/**
 * Shown on /platform to a signed-in account without the superadmin claim.
 * Accounts listed in PLATFORM_SUPERADMIN_EMAILS (functions/.env) can turn it
 * on here; everyone else is told to ask an existing superadmin.
 */
export default function SuperadminActivatePage() {
  const { email, refresh } = useSuperadmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function activate() {
    setBusy(true);
    setError('');
    try {
      await platformService.claimSuperadmin();
      await refresh();
    } catch (err) {
      setError(errorText(err, 'Could not activate superadmin access'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A1628] p-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center">
        <img src="/brand/lumora-logo.svg" alt="Lumora Ventures" className="mx-auto h-14 w-14 rounded-full bg-white p-1" />
        <div>
          <h1 className="text-xl font-bold text-white!">FirmiCore platform console</h1>
          <p className="mt-2 text-sm text-slate-400">
            For Lumora Ventures staff. <span className="text-slate-300">{email}</span> doesn't have superadmin access yet.
          </p>
        </div>
        <button onClick={() => void activate()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white! hover:bg-blue-500 disabled:opacity-60">
          <ShieldCheck className="h-4 w-4" /> {busy ? 'Activating…' : 'Activate superadmin access'}
        </button>
        {error && <p className="text-sm text-red-300 break-words">{error}</p>}
        <p className="text-xs text-slate-500">
          Only the Lumora Ventures account on the platform's superadmin list can activate this console.
        </p>
        <Link to="/app/dashboard" className="block text-sm text-blue-300! hover:underline">Back to FirmiCore</Link>
      </div>
    </div>
  );
}
