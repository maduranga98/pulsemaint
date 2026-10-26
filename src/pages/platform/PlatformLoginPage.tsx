import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useSuperadmin } from '@/lib/platform/useSuperadmin';

/**
 * Sign-in for Lumora staff who have no company login (sales managers).
 * Email + password only; what the account may see is decided by its token
 * claims inside PlatformLayout.
 */
export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const { ready, signedIn } = useSuperadmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (ready && signedIn) return <Navigate to="/platform" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/platform', { replace: true });
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(code === 'auth/user-disabled'
        ? 'This account has been disabled. Contact Lumora Ventures.'
        : 'Wrong email or password.');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A1628] p-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-md space-y-4 rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-8">
        <div className="text-center">
          <img src="/brand/lumora-logo.svg" alt="Lumora Ventures" className="mx-auto h-14 w-14 rounded-full bg-white p-1" />
          <h1 className="mt-3 text-xl font-bold text-white!">FirmiCore platform sign-in</h1>
          <p className="mt-1 text-sm text-slate-400">For Lumora Ventures sales staff.</p>
        </div>
        <label className="block text-sm text-slate-300">
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm text-slate-300">
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} />
        </label>
        {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white! hover:bg-blue-500 disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
