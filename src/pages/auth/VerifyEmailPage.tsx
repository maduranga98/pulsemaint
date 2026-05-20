import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { sendPasswordReset, logout } from '../../lib/auth';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [isVerified, setIsVerified] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const email = auth.currentUser?.email || '';

  useEffect(() => {
    const interval = setInterval(async () => {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        setIsVerified(true);
        setTimeout(() => navigate('/app/onboarding'), 1500);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleResendEmail = async () => {
    try {
      setError(null);
      setResendLoading(true);
      await auth.currentUser?.sendEmailVerification();
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend email.');
    } finally {
      setResendLoading(false);
    }
  };

  if (isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-white text-lg">Email verified! Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#1A56DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify your email</h2>
            <p className="text-gray-600">
              We sent a verification link to <strong>{email}</strong>. Click the link to activate your account.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="pt-4 space-y-4">
            <button
              onClick={handleResendEmail}
              disabled={resendCountdown > 0 || resendLoading}
              className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11"
            >
              {resendLoading
                ? 'Sending...'
                : resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : 'Resend email'}
            </button>

            <div className="space-y-2 text-sm">
              <a href="/register" className="block text-[#1A56DB] hover:underline">
                Change email address
              </a>
              <button
                onClick={() => logout().then(() => navigate('/login'))}
                className="block text-[#1A56DB] hover:underline"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
