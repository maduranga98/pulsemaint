import { useAuthStore } from '@/store/authStore';
import { useTrainingCertificates } from '@/hooks/training/useTrainingCertificates';
import { useMyProgramme } from '@/hooks/traineeProgram/useMyProgramme';
import { useProgrammeCertificate } from '@/hooks/traineeProgram/useProgrammeCertificate';
import { useMyProgramCertificates } from '@/hooks/training/useMyProgramCertificates';
import MyCertificatesList from '@/components/training/learner/MyCertificatesList';
import ProgrammeCertificateCard from '@/components/training/learner/ProgrammeCertificateCard';
import ProgramCertificateCard from '@/components/training/learner/ProgramCertificateCard';

export default function MyCertificatesPage() {
  const userId = useAuthStore((s) => s.userProfile?.id);
  const { certificates, loading } = useTrainingCertificates({ traineeId: userId });
  // A trainee programme's completion certificate — separate from individual
  // module certificates above, only present once the programme has been
  // signed off by an admin/plant manager/HR officer.
  const { programme } = useMyProgramme();
  const { certificate: programmeCertificate } = useProgrammeCertificate(programme?.certificateId ?? null);
  // A signed-off assigned training program (Trainee Management → Assigned) —
  // a third, separate certificate type from an admin/supervisor sign-off.
  const { certificates: programCertificates } = useMyProgramCertificates();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Certificates</h1>
        {!loading && certificates.length > 0 && (
          <p className="mt-1 text-slate-600">{certificates.length} certificate{certificates.length > 1 ? 's' : ''} earned</p>
        )}
      </div>

      {programmeCertificate && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Programme Certificate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProgrammeCertificateCard certificate={programmeCertificate} />
          </div>
        </div>
      )}

      {programCertificates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Program Certificates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {programCertificates.map((pa) => (
              <ProgramCertificateCard key={pa.id} programAssignment={pa} />
            ))}
          </div>
        </div>
      )}

      <MyCertificatesList certificates={certificates} loading={loading} />
    </div>
  );
}
