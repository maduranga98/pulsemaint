import { useAuthStore } from '@/store/authStore';
import { useTrainingCertificates } from '@/hooks/training/useTrainingCertificates';
import MyCertificatesList from '@/components/training/learner/MyCertificatesList';

export default function MyCertificatesPage() {
  const userId = useAuthStore((s) => s.userProfile?.id);
  const { certificates, loading } = useTrainingCertificates({ traineeId: userId });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Certificates</h1>
        {!loading && certificates.length > 0 && (
          <p className="mt-1 text-slate-600">{certificates.length} certificate{certificates.length > 1 ? 's' : ''} earned</p>
        )}
      </div>
      <MyCertificatesList certificates={certificates} loading={loading} />
    </div>
  );
}
