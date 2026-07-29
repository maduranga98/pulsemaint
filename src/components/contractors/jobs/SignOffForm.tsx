import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorJob, MachineStatusAfter } from '@/lib/contractors/contractorTypes';
import { syncContractorMetrics } from '@/lib/contractors/contractorMetricsSync';
import { useJobPartsCost } from '@/hooks/contractors/useJobPartsCost';
import { notifyRoles } from '@/services/notifications.service';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';
import RatingStarSelector from './RatingStarSelector';
import SignaturePad from './SignaturePad';

interface SignOffFormProps {
  job: ContractorJob;
}

const MACHINE_STATUS_OPTIONS: Array<{ value: MachineStatusAfter; label: string }> = [
  { value: 'operational', label: 'Operational' },
  { value: 'partially_operational', label: 'Partially Operational' },
  { value: 'still_down', label: 'Still Down' },
];

export function SignOffForm({ job }: SignOffFormProps) {
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const [workDoneDescription, setWorkDoneDescription] = useState(job.workDoneDescription ?? '');
  const [machineStatusAfter, setMachineStatusAfter] = useState<MachineStatusAfter>(job.machineStatusAfter ?? 'operational');
  const [signature, setSignature] = useState('');
  const [hasConcerns, setHasConcerns] = useState(Boolean(job.isDisputed));
  const [notes, setNotes] = useState(job.signOffNotes ?? job.disputeNotes ?? '');
  // Total cost = used-parts cost + the project cost entered here.
  // The parts figure is derived live from the linked work order's partsUsed
  // (and any materials logged on the job itself) rather than from the
  // never-written `job.totalPartsCost`, which always read 0.
  const autoPartsCost = useJobPartsCost(job);
  const initialProjectCost = job.projectCost != null
    ? job.projectCost
    : job.totalProjectCost != null
      ? Math.max(0, job.totalProjectCost - autoPartsCost)
      : job.systemInvoiceAmount != null
        ? Math.max(0, job.systemInvoiceAmount - autoPartsCost)
        : 0;
  const [projectCost, setProjectCost] = useState(initialProjectCost ? String(initialProjectCost) : '');
  const [speed, setSpeed] = useState(job.rating?.speedScore ?? 0);
  const [quality, setQuality] = useState(job.rating?.qualityScore ?? 0);
  const [professionalism, setProfessionalism] = useState(job.rating?.professionalismScore ?? 0);
  const [communication, setCommunication] = useState(job.rating?.communicationScore ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedProjectCost = useMemo(() => {
    const n = projectCost.trim() ? Number(projectCost.replace(/,/g, '')) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [projectCost]);
  const totalProjectCost = useMemo(
    () => Number((autoPartsCost + parsedProjectCost).toFixed(2)),
    [autoPartsCost, parsedProjectCost],
  );

  const overallRating = useMemo(() => {
    const scores = [speed, quality, professionalism, communication];
    return scores.every(Boolean) ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0;
  }, [speed, quality, professionalism, communication]);

  const ratingDimensions: Array<{ label: string; value: number; setter: Dispatch<SetStateAction<number>> }> = [
    { label: 'Speed', value: speed, setter: setSpeed },
    { label: 'Quality', value: quality, setter: setQuality },
    { label: 'Professionalism', value: professionalism, setter: setProfessionalism },
    { label: 'Communication', value: communication, setter: setCommunication },
  ];

  async function handleSignOff() {
    if (!signature) {
      setError('A signature is required to sign off this job.');
      return;
    }
    if (projectCost.trim() && (Number.isNaN(Number(projectCost.replace(/,/g, ''))) || Number(projectCost.replace(/,/g, '')) < 0)) {
      setError('Enter a valid project cost.');
      return;
    }
    if (overallRating === 0 && !job.rating) {
      setError('Rate all four areas before signing off this job.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const ratingPayload =
        overallRating > 0
          ? {
              speedScore: speed,
              qualityScore: quality,
              professionalismScore: professionalism,
              communicationScore: communication,
              overallScore: overallRating,
              notes: notes.trim() || null,
              ratedBy: userProfile?.id ?? null,
              ratedByName: userProfile?.fullName ?? null,
              ratedAt: serverTimestamp(),
            }
          : (job.rating ?? null);

      await updateDoc(doc(db, 'contractorJobs', job.id), {
        status: 'signed_off',
        workDoneDescription: workDoneDescription.trim() || null,
        machineStatusAfter,
        signedOffBy: userProfile?.id ?? null,
        signedOffByName: userProfile?.fullName ?? null,
        signedOffAt: serverTimestamp(),
        signOffNotes: notes.trim() || null,
        signOffSignature: signature,
        isDisputed: hasConcerns,
        disputeNotes: hasConcerns ? notes.trim() || null : null,
        rating: ratingPayload,
        // Total cost = used-parts cost + project cost. Each part is stored
        // separately so the contractor's job history can show the breakdown,
        // and the total is mirrored into systemInvoiceAmount because the
        // machine cost roll-up and maintenance cost analysis read that field.
        totalPartsCost: autoPartsCost,
        projectCost: parsedProjectCost,
        totalProjectCost,
        systemInvoiceAmount: totalProjectCost,
        signOffRating: overallRating > 0 ? overallRating : (job.rating?.overallScore ?? null),
        signOffTotalProjectCost: totalProjectCost,
        updatedAt: serverTimestamp(),
      });

      if (job.contractorId) {
        try {
          await syncContractorMetrics(job.contractorId, job.companyId);
        } catch (syncErr) {
          console.error('Failed to sync contractor metrics after sign-off', syncErr);
        }
      }

      // Oversight roles are copied on every notification (see
      // notifications.service), so a contractor sign-off reaches admins and
      // plant managers whoever performed it.
      void notifyRoles(job.companyId, ['supervisor'], {
        type: 'work_order',
        message: `${userProfile?.fullName ?? 'Someone'} signed off contractor job ${job.workOrderNumber} (${job.contractorName}) — total ${formatLkr(totalProjectCost)}`,
        oversightMessage: `signed off contractor job ${job.workOrderNumber} (${job.contractorName}) — total ${formatLkr(totalProjectCost)}`,
        actorName: userProfile?.fullName ?? '',
        actorRole: userProfile?.role,
        linkTo: `/app/contractors/jobs/${job.id}`,
      });

      toast.success('Job signed off successfully');
      navigate(`/app/contractors/jobs/${job.id}`);
    } catch (err) {
      console.error('Sign-off failed', err);
      const message = err instanceof Error ? err.message : 'Failed to sign off this job.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Review Summary</h2>
        <textarea
          value={workDoneDescription}
          onChange={(event) => setWorkDoneDescription(event.target.value)}
          placeholder="Work done description"
          className="mt-3 min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            value={machineStatusAfter}
            onChange={(event) => setMachineStatusAfter(event.target.value as MachineStatusAfter)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          >
            {MACHINE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Total Cost</h2>
        <p className="mt-1 text-xs text-slate-500">
          Used-parts cost (from this work order) plus the project cost you enter below. Recorded against
          this work order, the machine's cost history and the maintenance cost analysis.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">Used Parts Cost (auto)</label>
            <div className="mt-1 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              <span className="font-medium text-slate-500">LKR</span>
              <span>{autoPartsCost.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Project Cost</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">LKR</span>
              <input
                value={projectCost}
                onChange={(event) => setProjectCost(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            Total cost — used parts {formatLkr(autoPartsCost)} + project {formatLkr(parsedProjectCost)}
          </p>
          <p className="text-lg font-bold text-slate-950">{formatLkr(totalProjectCost)}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Contractor Rating</h2>
        <p className="mt-1 text-xs text-slate-500">
          Rate all four areas — a rating is required to sign off, and appears in this contractor's job history.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ratingDimensions.map(({ label, value, setter }) => (
            <div key={label} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <div className="mt-2"><RatingStarSelector value={value} onChange={setter} /></div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-500">Overall score</p>
          <p className="text-2xl font-bold text-slate-950">{overallRating ? overallRating.toFixed(1) : '-'}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Digital Signature</h2>
        <div className="mt-3"><SignaturePad onChange={setSignature} /></div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={hasConcerns} onChange={(event) => setHasConcerns(event.target.checked)} />
          I have concerns about the quality of this work
        </label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Sign-off notes or dispute notes"
          className="mt-3 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => void handleSignOff()}
          disabled={saving}
          className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          {saving ? 'Saving…' : 'Sign Off & Complete'}
        </button>
      </section>
    </form>
  );
}

export default SignOffForm;
