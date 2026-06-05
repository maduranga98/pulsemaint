import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import PasswordStrength from '../../components/auth/PasswordStrength';

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
  const [inviteStatus, setInviteStatus] = useState<'loading' | 'valid' | 'expired' | 'used'>('loading');
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  });

  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch('/.netlify/functions/validateInviteToken', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        const data = await response.json();

        if (data.valid) {
          setInviteDetails(data);
          setInviteStatus('valid');
          form.setValue('fullName', data.fullName || '');
        } else if (data.expired) {
          setInviteStatus('expired');
        } else if (data.used) {
          setInviteStatus('used');
        }
      } catch (err) {
        setInviteStatus('expired');
      }
    };

    validateToken();
  }, [token, form]);

  const handleSubmit = async (data: InviteForm) => {
    try {
      setLoading(true);
      const response = await fetch('/.netlify/functions/acceptInvitation', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password: data.password,
          fullName: data.fullName,
        }),
      });

      const result = await response.json();
      if (result.success) {
        navigate('/app/onboarding');
      } else {
        form.setError('fullName', { message: result.error || 'Failed to accept invitation.' });
      }
    } catch (err: any) {
      form.setError('fullName', { message: err.message || 'An error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  if (inviteStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center">
        <div className="text-white text-center">Loading...</div>
      </div>
    );
  }

  if (inviteStatus === 'expired') {
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

  if (inviteStatus === 'used') {
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
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're invited!</h2>
            <p className="text-gray-600">
              You've been invited to join <strong>{inviteDetails?.companyName}</strong> as{' '}
              <strong>{inviteDetails?.role}</strong>
            </p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                {...form.register('fullName')}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              {form.formState.errors.fullName && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                {...form.register('password')}
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <PasswordStrength
              password={form.watch('password') || ''}
              confirmPassword={form.watch('confirmPassword') || ''}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                {...form.register('confirmPassword')}
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11"
            >
              {loading ? 'Accepting...' : 'Accept Invitation'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
