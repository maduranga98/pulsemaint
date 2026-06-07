import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import PasswordStrength from '../../components/auth/PasswordStrength';
import {
  validateInviteToken,
  acceptInviteWithPassword,
  acceptInviteWithGoogle,
} from '../../lib/invitations';
import { getDashboardRoute, logout } from '../../lib/auth';
import { auth } from '../../lib/firebase';
import type { Invitation } from '../../types/auth';

const inviteSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Z]/, 'Must contain uppercase letter.')
      .regex(/\d/, 'Must contain a number.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type InviteForm = z.infer<typeof inviteSchema>;

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'used'>('loading');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  });

  useEffect(() => {
    if (!token) return;
    (async () => {
      if (auth.currentUser) {
        await logout();
      }
      const result = await validateInviteToken(token);
      if (result.valid) {
        setInvitation(result.invitation);
        setStatus('valid');
        form.setValue('fullName', result.invitation.fullName || '');
      } else {
        setStatus(result.reason === 'used' ? 'used' : 'expired');
      }
    })();
  }, [token, form]);

  const handleSubmit = async (data: InviteForm) => {
    if (!invitation) return;
    try {
      setLoading(true);
      setError(null);
      const profile = await acceptInviteWithPassword(invitation, data.password, data.fullName);
      navigate(getDashboardRoute(profile.role), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAccept = async () => {
    if (!invitation) return;
    try {
      setGoogleLoading(true);
      setError(null);
      const profile = await acceptInviteWithGoogle(invitation);
      navigate(getDashboardRoute(profile.role), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Google sign-up failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center">
        <div className="animate-pulse text-white text-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          Verifying invitation...
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Expired</h2>
          <p className="text-gray-600 mb-6">
            This invitation has expired. Please contact your administrator for a new one.
          </p>
          <a
            href="/login"
            className="inline-block bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  if (status === 'used') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Already Used</h2>
          <p className="text-gray-600 mb-6">This invitation has already been accepted. Try signing in.</p>
          <a
            href="/login"
            className="inline-block bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 flex flex-col items-center">
          <img src="/logo.png" alt="PulseMaint" className="h-14 w-auto mb-2" />
          <div className="text-2xl font-bold">
            <span className="text-white">Pulse</span>
            <span className="text-[#00C2FF]">Maint</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're invited!</h2>
            <p className="text-gray-600">
              You've been invited to join <strong>{invitation?.companyName}</strong> as a{' '}
              <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-sm font-medium">
                {invitation?.role?.replace('_', ' ')}
              </span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Invited by {invitation?.invitedByName}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Email: </span>
            {invitation?.email}
          </div>

          <button
            onClick={handleGoogleAccept}
            disabled={googleLoading || loading}
            className="w-full border border-gray-200 bg-white text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 h-11"
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
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or set up with email &amp; password</span>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                {...form.register('fullName')}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              {form.formState.errors.fullName && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  {...form.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <PasswordStrength
              password={form.watch('password') || ''}
              confirmPassword={form.watch('confirmPassword') || ''}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                {...form.register('confirmPassword')}
                type="password"
                placeholder="Re-enter password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 h-11"
            >
              {loading ? 'Creating account...' : 'Accept & Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-[#1A56DB] hover:underline font-medium">
              Sign in instead
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
