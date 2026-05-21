import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import RatingQuickTags from './RatingQuickTags';
import RatingStarSelector from './RatingStarSelector';
import FollowUpFlagToggle from './FollowUpFlagToggle';

interface RatingFormProps {
  job: ContractorJob;
}

export function RatingForm({ job }: RatingFormProps) {
  const [speed, setSpeed] = useState(job.rating?.speedScore ?? 0);
  const [quality, setQuality] = useState(job.rating?.qualityScore ?? 0);
  const [professionalism, setProfessionalism] = useState(job.rating?.professionalismScore ?? 0);
  const [communication, setCommunication] = useState(job.rating?.communicationScore ?? 0);
  const [notes, setNotes] = useState(job.rating?.notes ?? '');
  const [followUp, setFollowUp] = useState(Boolean(job.followUpRequired));
  const overall = useMemo(() => {
    const scores = [speed, quality, professionalism, communication];
    return scores.every(Boolean) ? scores.reduce((sum, score) => sum + score, 0) / 4 : 0;
  }, [communication, professionalism, quality, speed]);
  const dimensions: Array<{
    label: string;
    value: number;
    setter: Dispatch<SetStateAction<number>>;
    helper: string;
  }> = [
    { label: 'Speed', value: speed, setter: setSpeed, helper: 'How fast was the repair completed?' },
    { label: 'Quality', value: quality, setter: setQuality, helper: 'How well was the work done?' },
    { label: 'Professionalism', value: professionalism, setter: setProfessionalism, helper: 'How professional was the contractor team?' },
    { label: 'Communication', value: communication, setter: setCommunication, helper: 'How well did they communicate?' },
  ];

  return (
    <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Rate {job.contractorName}</h2>
      {dimensions.map(({ label, value, setter, helper }) => (
        <div key={label} className="rounded-lg border border-slate-200 p-3">
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{helper}</p>
          <div className="mt-2"><RatingStarSelector value={value} onChange={setter} /></div>
        </div>
      ))}
      <div className="rounded-lg bg-slate-50 p-4 text-center">
        <p className="text-sm text-slate-500">Overall score</p>
        <p className="text-3xl font-bold text-slate-950">{overall ? overall.toFixed(1) : '-'}</p>
      </div>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add detailed feedback" className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
      <RatingQuickTags onSelect={(tag) => setNotes((value) => (value ? `${value}, ${tag}` : tag))} />
      <FollowUpFlagToggle enabled={followUp} onChange={setFollowUp} />
      <button type="button" className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white sm:w-auto">Submit Rating</button>
    </form>
  );
}

export default RatingForm;
