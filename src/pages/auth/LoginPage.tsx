import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, QrCode, X, ShieldCheck, Gauge, Wrench, BarChart3 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Html5Qrcode } from 'html5-qrcode';
import OTPInput from '../../components/auth/OTPInput';
import {
  loginWithEmail,
  loginWithGoogle,
  loginWithPhone,
  confirmOTP,
  loginWithPin,
  changePin,
  authErrorMessages,
  getDashboardRoute,
} from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import { consumePostLoginRedirect } from '../../lib/scanTarget';
import type { ConfirmationResult } from 'firebase/auth';

const emailLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type EmailLoginForm = z.infer<typeof emailLoginSchema>;

const phoneNumberSchema = z.object({
  countryCode: z.string().min(1, 'Country code is required.'),
  phoneNumber: z.string().min(6, 'Please enter a valid phone number.'),
});

type PhoneNumberForm = z.infer<typeof phoneNumberSchema>;

const employeePinSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required.'),
});

type EmployeePinForm = z.infer<typeof employeePinSchema>;

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
  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp' | 'pin'>('phone');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPinChangeModal, setShowPinChangeModal] = useState(false);
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [, setOtpCountdown] = useState(0);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const recaptchaRef = useRef<HTMLDivElement>(null);
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

  const phoneForm = useForm<PhoneNumberForm>({
    resolver: zodResolver(phoneNumberSchema),
    defaultValues: { countryCode: '+94' },
  });

  const pinForm = useForm<EmployeePinForm>({
    resolver: zodResolver(employeePinSchema),
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

  const handlePhoneSubmit = async (data: PhoneNumberForm) => {
    try {
      setError(null);
      setLoading(true);
      const fullPhoneNumber = `${data.countryCode}${data.phoneNumber.replace(/^\+?\d+/, '').replace(/\D/g, '')}`;
      const result = await loginWithPhone(fullPhoneNumber);
      setConfirmationResult(result);
      setPhoneStep('otp');
      setOtpCountdown(60);
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || 'Failed to send OTP.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    if (!confirmationResult) return;
    try {
      setError(null);
      setLoading(true);
      const profile = await confirmOTP(confirmationResult, otp);
      navigate(postLoginRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || 'OTP verification failed.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (companyId: string) => {
    if (pinInput.length !== 6) return;
    try {
      setError(null);
      setLoading(true);
      const profile = await loginWithPin(companyId, pinInput);
      navigate(postLoginRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      if (errorCode === 'PIN_CHANGE_REQUIRED') {
        setCurrentCompanyId(companyId);
        setCurrentUserId(useAuthStore.getState().user?.uid || '');
        setShowPinChangeModal(true);
      } else {
        const errorMessage = authErrorMessages[errorCode] || 'PIN login failed.';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080F1F] flex">
      {/* Marketing panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0A1628] via-[#0C1B33] to-[#102544] flex-col p-12">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, #00C2FF 0, transparent 35%), radial-gradient(circle at 80% 70%, #1A56DB 0, transparent 40%)',
        }} />

        <div className="relative flex items-center gap-3">
          <img src="/logo.svg" alt="FirmiCore" className="h-10 w-auto" />
          <div className="text-2xl font-bold">
            <span className="text-white">Firmi</span>
            <span className="text-[#00C2FF]">Core</span>
          </div>
        </div>

        <div className="relative flex-1 flex flex-col justify-center">
          {/* Global `h1,h2,...{color:#0f172a}` in style.css is an unlayered
              rule, so it beats Tailwind's layered `text-white` utility here —
              force the color inline rather than fight the cascade. */}
          <h1 className="text-4xl font-bold leading-tight mb-4" style={{ color: '#ffffff' }}>
            One platform for every machine, breakdown, and technician on your floor.
          </h1>
          <p className="text-slate-300 text-base max-w-md mb-10">
            FirmiCore is the multi-tenant maintenance-management platform that keeps machine
            registries, breakdowns, work orders, PM scheduling, inventory, and analytics in one
            place — so nothing falls through the cracks.
          </p>

          <div className="space-y-5 max-w-md">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-white/10"><Gauge className="w-5 h-5 text-[#00C2FF]" /></div>
              <div>
                <p className="text-white font-medium text-sm">Real-time breakdown tracking</p>
                <p className="text-slate-400 text-sm">From "reported" to "assigned" to "resolved" — everyone sees live status.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-white/10"><Wrench className="w-5 h-5 text-[#00C2FF]" /></div>
              <div>
                <p className="text-white font-medium text-sm">Work orders &amp; PM scheduling</p>
                <p className="text-slate-400 text-sm">Assign technicians, track parts, and stay ahead of preventive maintenance.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-white/10"><ShieldCheck className="w-5 h-5 text-[#00C2FF]" /></div>
              <div>
                <p className="text-white font-medium text-sm">Role-based access &amp; audit trails</p>
                <p className="text-slate-400 text-sm">Nine tailored roles, from floor operator to plant manager, each with the right view.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-white/10"><BarChart3 className="w-5 h-5 text-[#00C2FF]" /></div>
              <div>
                <p className="text-white font-medium text-sm">Analytics that matter</p>
                <p className="text-slate-400 text-sm">Machine health, OEE, and reliability trends, computed automatically.</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-slate-500 text-xs">© {new Date().getFullYear()} FirmiCore. All rights reserved.</p>
      </div>
      {/* Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center lg:hidden">
          <img src="/logo.svg" alt="FirmiCore" className="h-16 w-auto mb-3" />
          <div className="text-3xl font-bold">
            <span className="text-white">Firmi</span>
            <span className="text-[#00C2FF]">Core</span>
          </div>
        </div>

        <div className="bg-[#111C33] border border-white/10 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#ffffff' }}>Welcome back</h2>
          <p className="text-slate-400 text-sm mb-5">Sign in to your FirmiCore account</p>

          {error && (
            <div className="mb-6 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <input
                  {...emailForm.register('email')}
                  type="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-2 border border-white/10 bg-white/5 text-white placeholder:text-slate-500 rounded-lg focus:border-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF]/20 outline-none transition-all"
                />
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
                  <input
                    {...emailForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-white/10 bg-white/5 text-white placeholder:text-slate-500 rounded-lg focus:border-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF]/20 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400"
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
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11 flex items-center justify-center"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#111C33] text-slate-400">— or continue with —</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full border border-white/10 bg-white text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 h-11"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
            </div>
          )}

        </div>

        <p className="text-center text-slate-400 text-sm">
          Don't have an account?{' '}
          <a href="/register" className="text-[#00C2FF] hover:underline font-medium">
            Register your company
          </a>
        </p>

        <button
          type="button"
          onClick={openQrScanner}
          className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-white/10 bg-white/5 text-slate-200 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors"
        >
          <QrCode className="w-4 h-4 text-[#00C2FF]" />
          Report a breakdown by QR — no sign-in needed
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

      {showPinChangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Change Your PIN</h3>
            <p className="text-gray-600 text-sm mb-6">You must change your PIN before continuing.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New PIN</label>
                <OTPInput length={6} masked onComplete={(value) => setNewPin(value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm PIN</label>
                <OTPInput length={6} masked onComplete={(value) => setConfirmPin(value)} />
              </div>

              {newPin && confirmPin && newPin !== confirmPin && (
                <p className="text-red-500 text-sm">PINs do not match.</p>
              )}

              <button
                onClick={async () => {
                  try {
                    setError(null);
                    setPinChangeLoading(true);
                    await changePin(currentUserId, currentCompanyId, newPin);
                    setShowPinChangeModal(false);
                    setNewPin('');
                    setConfirmPin('');
                    const userRole = useAuthStore.getState().userProfile?.role;
                    if (userRole) navigate(postLoginRoute(userRole));
                  } catch (err: any) {
                    setError(err.message || 'Failed to change PIN.');
                  } finally {
                    setPinChangeLoading(false);
                  }
                }}
                disabled={!newPin || !confirmPin || newPin !== confirmPin || pinChangeLoading}
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-10"
              >
                {pinChangeLoading ? 'Updating...' : 'Update PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
