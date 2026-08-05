import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, documentId, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { db } from '../../lib/firebase';
import type { Breakdown } from '../../types/breakdown';
import { BreakdownDetailCard } from '../../components/breakdowns/BreakdownDetailCard';

/**
 * All breakdown tickets grouped on the Breakdowns list for one machine (the
 * row a machine name links to) — shown together with every field filled in
 * by whoever reported/attended/repaired each one, so a supervisor doesn't
 * have to open each ticket individually to see the full picture on a
 * machine before creating or signing off its work order.
 */
export default function BreakdownGroupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean);

  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [actorRoles, setActorRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setError('No breakdown tickets specified.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Firestore's `in` filter caps at 30 ids — fetch individually so a
    // machine with a larger backlog still loads everything.
    Promise.all(ids.map((id) => getDoc(doc(db, 'breakdown_tickets', id))))
      .then((snaps) => {
        if (cancelled) return;
        const found = snaps.filter((s) => s.exists()).map((s) => ({ ...s.data(), id: s.id } as Breakdown));
        found.sort((a, b) => (b.reportedAt?.toDate?.().getTime() ?? 0) - (a.reportedAt?.toDate?.().getTime() ?? 0));
        setBreakdowns(found);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load breakdowns.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  // Resolve every actor's current role across every ticket in the group
  // (attended-by, assigned technicians, status history) — Firestore's `in`
  // filter caps at 30 ids.
  useEffect(() => {
    if (breakdowns.length === 0) return;
    const uids = Array.from(
      new Set(
        breakdowns.flatMap((b) => [
          b.attendedBy,
          ...(b.assignedTechnicianIds ?? []),
          ...(b.statusHistory ?? []).map((h: any) => h.changedBy),
        ]),
      ),
    ).filter((id): id is string => !!id).slice(0, 30);
    if (uids.length === 0) return;
    getDocs(query(collection(db, 'users'), where(documentId(), 'in', uids)))
      .then((snap) => {
        const roles: Record<string, string> = {};
        snap.docs.forEach((d) => {
          roles[d.id] = (d.data() as any).role ?? '';
        });
        setActorRoles(roles);
      })
      .catch(() => {}); // silently ignore permission errors
  }, [breakdowns]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-slate-500">Loading breakdowns…</p>
      </div>
    );
  }

  if (error || breakdowns.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-700">{error || 'No breakdowns found.'}</p>
          <button
            onClick={() => navigate('/app/breakdowns')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Back to Breakdowns
          </button>
        </div>
      </div>
    );
  }

  const machineName = breakdowns[0].machineName;
  const machineLocation = breakdowns[0].machineLocation;

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <button
          type="button"
          onClick={() => navigate('/app/breakdowns')}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Breakdowns
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{machineName}</h1>
        <p className="text-sm text-slate-500">
          {machineLocation ? `${machineLocation} · ` : ''}
          {breakdowns.length} breakdown{breakdowns.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">
        {breakdowns.map((b) => (
          <div key={b.id}>
            <div className="flex items-center justify-between mb-2">
              <a
                href={`/app/breakdowns/${b.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/app/breakdowns/${b.id}`);
                }}
                className="font-semibold text-blue-600 hover:underline text-sm"
              >
                {b.ticketNumber}
              </a>
            </div>
            <BreakdownDetailCard breakdown={b} actorRoles={actorRoles} />
          </div>
        ))}
      </div>
    </div>
  );
}
