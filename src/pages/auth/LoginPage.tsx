import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, QrCode, X, ShieldCheck, Zap, Workflow, Target, Mail, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Html5Qrcode } from 'html5-qrcode';
import {
  loginWithEmail,
  loginWithGoogle,
  authErrorMessages,
  getDashboardRoute,
} from '../../lib/auth';
import { consumePostLoginRedirect } from '../../lib/scanTarget';

const emailLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type EmailLoginForm = z.infer<typeof emailLoginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Deep link (e.g. a scanned machine QR) the user was heading to before
  // being redirected to login. sessionStorage fallback covers page reloads
  // (reCAPTCHA, redirect sign-in) where router state is lost. Resolved at
  // navigation time so a stale render closure can't drop it.
  const postLoginRoute = (role: string) => {
    const returnTo =
      (location.state as { from?: string } | null)?.from ?? consumePostLoginRedirect();
    return returnTo ?? getDashboardRoute(role as any);
  };
  const activeTab = 'email' as const;
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  async function openQrScanner() {
    setShowQrScanner(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('login-qr-reader');
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            await scanner.stop();
            qrScannerRef.current = null;
            setShowQrScanner(false);
            try {
              const url = new URL(decodedText);
              const machineId = url.searchParams.get('machineId');
              if (machineId) {
                navigate(`/report-breakdown?machineId=${machineId}`);
              } else {
                setError('QR code did not contain a valid machine ID.');
              }
            } catch {
              setError('Unrecognized QR code.');
            }
          },
          () => {},
        );
      } catch (err: any) {
        setError(err?.message || 'Failed to open camera.');
        setShowQrScanner(false);
      }
    }, 100);
  }

  async function closeQrScanner() {
    if (qrScannerRef.current) {
      try { await qrScannerRef.current.stop(); } catch {}
      qrScannerRef.current = null;
    }
    setShowQrScanner(false);
  }

  // Surfaces the reason when useAuthInit force-signed the user out mid-session
  // (e.g. an admin just marked their account inactive) — the store's error is
  // cleared by the reset() that accompanies the sign-out, so this is stashed
  // separately for the login screen to show once.
  useEffect(() => {
    const notice = sessionStorage.getItem('pulsemaint:deactivation-notice');
    if (notice) {
      setError(notice);
      sessionStorage.removeItem('pulsemaint:deactivation-notice');
    }
  }, []);

  const emailForm = useForm<EmailLoginForm>({
    resolver: zodResolver(emailLoginSchema),
  });

  const handleEmailLogin = async (data: EmailLoginForm) => {
    try {
      setError(null);
      setLoading(true);
      const profile = await loginWithEmail(data.email, data.password);
      navigate(postLoginRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || err.message || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setGoogleLoading(true);
      const profile = await loginWithGoogle();
      navigate(postLoginRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || err.message || 'Google login failed.';
      setError(errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B33] flex">
      {/* Marketing panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0C1B33] to-[#12335C] flex-col p-12">
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#1A56DB]/25 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-16 w-80 h-80 rounded-full bg-[#00C2FF]/15 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <img src="/logo.svg" alt="FirmiCore" className="h-9 w-auto" />
          <div className="text-xl font-bold" style={{ fontFamily: "'Sora', var(--font-sans)" }}>
            <span className="text-white">Firmi</span>
            <span className="text-[#00C2FF]">Core</span>
          </div>
        </div>

        {/* `p`/`h1`-`h6` get an unlayered `margin: 0` reset in style.css that
            outranks Tailwind's layered mb-* / space-y-* utilities on those
            tags, which was collapsing the headline, paragraph, and feature
            rows on top of each other. `gap` on the flex parent sidesteps
            that entirely since it isn't a per-child margin. */}
        <div className="relative flex-1 flex flex-col justify-center gap-10">
          <div className="flex flex-col gap-4">
            <h1
              className="text-4xl leading-tight max-w-lg"
              style={{ color: '#ffffff', fontFamily: "'Sora', var(--font-sans)", fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              Turn breakdowns into<br />resolved work orders.
            </h1>
            <p className="text-slate-300 text-base leading-relaxed max-w-md">
              Collect, track, and resolve every machine breakdown in one place. Built for
              maintenance teams that want accountability, not just paperwork.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5">
              <Zap className="w-5 h-5 text-[#00C2FF] shrink-0" />
              <span className="text-white text-sm font-medium">Real-time tracking</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5">
              <Workflow className="w-5 h-5 text-[#00C2FF] shrink-0" />
              <span className="text-white text-sm font-medium">End-to-end workflow</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5">
              <ShieldCheck className="w-5 h-5 text-[#00C2FF] shrink-0" />
              <span className="text-white text-sm font-medium">Secure &amp; reliable</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5">
              <Target className="w-5 h-5 text-[#00C2FF] shrink-0" />
              <span className="text-white text-sm font-medium">Built for plants</span>
            </div>
          </div>
        </div>

        <p className="relative text-slate-400 text-xs">© {new Date().getFullYear()} FirmiCore. All rights reserved.</p>
      </div>

      {/* Login form. Vertically centering short content is fine on desktop,
          but on a short mobile viewport it can push the bottom of the form
          (the QR report button) below the fold with no obvious way to tell
          there's more to scroll to — so mobile flows from the top instead,
          only centering from the lg breakpoint up where there's headroom. */}
      <div className="w-full lg:w-1/2 flex items-start lg:items-center justify-center overflow-y-auto p-4 py-8 sm:p-8 bg-[#0D1B33]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center gap-2 lg:hidden">
          <img src="/logo.svg" alt="FirmiCore" className="h-14 w-auto" />
          <div className="text-2xl font-bold" style={{ fontFamily: "'Sora', var(--font-sans)" }}>
            <span className="text-white">Firmi</span>
            <span className="text-[#00C2FF]">Core</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 mb-6">
          <h2
            className="text-3xl"
            style={{ color: '#ffffff', fontFamily: "'Sora', var(--font-sans)", fontWeight: 700 }}
          >
            Sign In
          </h2>
          <p className="text-slate-400 text-sm">Sign in to your FirmiCore account</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg p-3 flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="flex flex-col gap-5">
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full border border-white/10 bg-[#0B1526] text-slate-100 font-medium py-2.5 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 h-12"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-[#0D1B33] text-slate-500">or sign in with email</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    {...emailForm.register('email')}
                    type="email"
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-white/10 bg-[#0B1526] text-white placeholder:text-slate-500 rounded-xl focus:border-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF]/20 outline-none transition-all"
                  />
                </div>
                {emailForm.formState.errors.email && (
                  <p className="text-red-400 text-sm mt-1">{emailForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-300">Password</label>
                  <a href="/forgot-password" className="text-sm text-[#00C2FF] hover:underline">
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    {...emailForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-2.5 border border-white/10 bg-[#0B1526] text-white placeholder:text-slate-500 rounded-xl focus:border-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF]/20 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {emailForm.formState.errors.password && (
                  <p className="text-red-400 text-sm mt-1">{emailForm.formState.errors.password.message}</p>
                )}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-slate-400">Remember me</span>
              </label>

              <button
                onClick={emailForm.handleSubmit(handleEmailLogin)}
                disabled={loading}
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 h-12 flex items-center justify-center"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-slate-400 text-sm mt-6">
          Don't have an account?{' '}
          <a href="/register" className="text-[#00C2FF] hover:underline font-medium">
            Create one
          </a>
        </p>

        <button
          type="button"
          onClick={openQrScanner}
          className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-white/10 bg-[#0B1526] text-slate-200 text-sm font-medium rounded-xl hover:bg-white/5 transition-colors"
        >
          <QrCode className="w-4 h-4 text-[#00C2FF]" />
          Report a breakdown by QR
        </button>
      </div>
      </div>

      {showQrScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Scan Machine QR Code</h3>
              <button type="button" onClick={closeQrScanner} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div id="login-qr-reader" className="w-full" />
            <p className="text-xs text-slate-500 mt-3 text-center">Point your camera at a machine QR code to report a breakdown instantly.</p>
          </div>
        </div>
      )}

    </div>
  );
}
