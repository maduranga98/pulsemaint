import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTrainingCertificates, revokeCertificate } from '@/hooks/training/useTrainingCertificates';
import { useAuthStore } from '@/store/authStore';
import CertificatesManager from '@/components/training/manager/CertificatesManager';

export default function CertificatesManagerPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userProfile?.id);
  const { certificates, loading } = useTrainingCertificates({ includeRevoked: true });

  const handleRevoke = async (id: string, reason: string) => {
    if (!userId) return;
    await revokeCertificate(id, reason, userId);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm">Certificates</h1>
      </div>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <CertificatesManager
          certificates={certificates}
          loading={loading}
          onRevoke={handleRevoke}
        />
      </div>
    </div>
  );
}
