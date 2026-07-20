import { useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';

interface ArrivalLogSectionProps {
  job: ContractorJob;
}

export function ArrivalLogSection({ job }: ArrivalLogSectionProps) {
  const access = useContractorAccess();
  const userProfile = useAuthStore((s) => s.userProfile);
  const [saving, setSaving] = useState(false);
  const arrived = Boolean(job.arrivedAt);
  const departed = Boolean(job.departedAt);

  async function logArrival() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'contractorJobs', job.id), {
        arrivedAt: serverTimestamp(),
        arrivedLoggedBy: userProfile?.id ?? '',
        status: job.status === 'invitation_sent' || job.status === 'acknowledged' ? 'contractor_arrived' : job.status,
        updatedAt: serverTimestamp(),
      });
      toast.success('Arrival logged.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log arrival');
    } finally {
      setSaving(false);
    }
  }

  async function logDeparture() {
    setSaving(true);
    try {
      const arrivedAt = job.arrivedAt?.toDate();
      const now = new Date();
      const onSiteDurationMinutes = arrivedAt
        ? Math.max(0, Math.round((now.getTime() - arrivedAt.getTime()) / 60000))
        : undefined;
      await updateDoc(doc(db, 'contractorJobs', job.id), {
        departedAt: Timestamp.fromDate(now),
        ...(onSiteDurationMinutes !== undefined ? { onSiteDurationMinutes } : {}),
        updatedAt: serverTimestamp(),
      });
      toast.success('Departure logged.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log departure');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">Arrival & Departure</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <MapPin className="mb-2 h-4 w-4 text-blue-600" />
          Arrival: {job.arrivedAt ? job.arrivedAt.toDate().toLocaleString() : 'Not arrived'}
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <Clock className="mb-2 h-4 w-4 text-blue-600" />
          Departure: {job.departedAt ? job.departedAt.toDate().toLocaleString() : 'Not departed'}
        </div>
      </div>
      {access.canLogContractorWork && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!arrived && (
            <button type="button" disabled={saving} onClick={logArrival} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              Log Contractor Arrival
            </button>
          )}
          {arrived && !departed && (
            <button type="button" disabled={saving} onClick={logDeparture} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              Log Departure
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default ArrivalLogSection;
