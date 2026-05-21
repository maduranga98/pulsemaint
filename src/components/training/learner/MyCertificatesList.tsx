import type { TrainingCertificate } from '@/lib/training/trainingTypes';
import CertificateCard from './CertificateCard';
import TrainingEmptyState from '../shared/TrainingEmptyState';

interface MyCertificatesListProps {
  certificates: TrainingCertificate[];
  loading: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-slate-100 rounded-2xl h-52 animate-pulse" />
  );
}

export default function MyCertificatesList({ certificates, loading }: MyCertificatesListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (certificates.length === 0) {
    return <TrainingEmptyState variant="no_certificates" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {certificates.map((cert) => (
        <CertificateCard key={cert.id} certificate={cert} />
      ))}
    </div>
  );
}
