import { useParams } from 'react-router-dom';
import { useContractorJob } from '@/hooks/contractors/useContractorJob';
import RatingForm from '@/components/contractors/jobs/RatingForm';

export function RateContractorPage() {
  const { jobId } = useParams();
  const { job, loading } = useContractorJob(jobId);

  if (loading) return <div className="p-6 text-slate-500">Loading rating form...</div>;
  if (!job) return <div className="p-6 text-slate-500">Job not found.</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <RatingForm job={job} />
    </div>
  );
}

export default RateContractorPage;
