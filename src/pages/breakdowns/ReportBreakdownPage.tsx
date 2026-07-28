import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { AlertCircle, ChevronLeft, QrCode } from 'lucide-react';
import { nanoid } from 'nanoid';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { consumePendingScanMachineId, consumePostLoginRedirect } from '../../lib/scanTarget';
import { notifyRoles } from '../../services/notifications.service';
import type { BreakdownSeverity, BreakdownType } from '../../types/breakdown';

interface MachineOption {
  id: string;
  name: string;
  department?: string;
  location?: string;
  criticality?: 1 | 2 | 3 | 4 | 5;
}

const SEVERITIES: { value: BreakdownSeverity; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical — production halted', color: 'bg-red-600 text-white' },
  { value: 'high', label: 'High — major impact', color: 'bg-orange-500 text-white' },
  { value: 'medium', label: 'Medium — minor impact', color: 'bg-amber-500 text-white' },
  { value: 'low', label: 'Low — cosmetic / observation', color: 'bg-slate-400 text-white' },
];

const TYPES: { value: BreakdownType; label: string }[] = [
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'pneumatic', label: 'Pneumatic' },
  { value: 'software', label: 'Software / Controls' },
  { value: 'other', label: 'Other' },
];

export default function ReportBreakdownPage() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId;

  const [searchParams] = useSearchParams();
  // Query param is the primary source; a pending scan stored during a QR
  // scan → login round-trip is the fallback.
  const [preselectedMachineId, setPreselectedMachineId] = useState(
    () => searchParams.get('machineId') || ''
  );

  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);

  const [machineId, setMachineId] = useState(preselectedMachineId);

  // Consume scan-flow storage in a committed effect, not during render:
  // a render that never commits must not eat the pending scan. Once we've
  // arrived here, also clear the stored post-login redirect so a stale
  // entry can't hijack a later login.
  useEffect(() => {
    const pending = consumePendingScanMachineId();
    consumePostLoginRedirect();
    if (pending) {
      setPreselectedMachineId((current) => current || pending);
      setMachineId((current) => current || pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [severity, setSeverity] = useState<BreakdownSeverity>('medium');
  const [breakdownType, setBreakdownType] = useState<BreakdownType>('mechanical');
  const [description, setDescription] = useState('');
  const [productionImpact, setProductionImpact] = useState('');
  const [currentProductionCount, setCurrentProductionCount] = useState('');
  const [attemptedFixes, setAttemptedFixes] = useState('');
  const [machineStillRunning, setMachineStillRunning] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    setMachinesLoading(true);
    getDocs(query(collection(db, 'machines'), where('siteId', '==', siteId)))
      .then(async (snap) => {
        const list: MachineOption[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || 'Unnamed',
            department: data.department,
            location: data.floor || data.bay || data.station,
            criticality: data.criticality,
          };
        });
        // A scanned QR may reference a machine outside the user's default
        // site — fetch it directly so it can still be auto-selected.
        if (preselectedMachineId && !list.some((m) => m.id === preselectedMachineId)) {
          try {
            const machineSnap = await getDoc(doc(db, 'machines', preselectedMachineId));
            if (machineSnap.exists()) {
              const data = machineSnap.data() as any;
              list.unshift({
                id: machineSnap.id,
                name: data.name || 'Unnamed',
                department: data.department,
                location: data.floor || data.bay || data.station,
                criticality: data.criticality,
              });
            }
          } catch {
            // Machine not readable — the user can still pick from the list.
          }
        }
        setMachines(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setMachinesLoading(false));
  }, [siteId, preselectedMachineId]);

  const scannedMachine = preselectedMachineId
    ? machines.find((m) => m.id === preselectedMachineId)
    : undefined;
  // Lock the machine when it was set by a QR scan and resolved successfully.
  const machineLocked = Boolean(scannedMachine && machineId === preselectedMachineId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userProfile || !siteId) {
      setError('Your account is not fully loaded yet. Try again in a moment.');
      return;
    }
    if (!machineId) {
      setError('Please select the machine that broke down.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Please describe the breakdown in at least 10 characters.');
      return;
    }

    const machine = machines.find((m) => m.id === machineId);
    if (!machine) {
      setError('Selected machine not found.');
      return;
    }

    setSubmitting(true);
    try {
      const ticketNumber = `BD-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
      await addDoc(collection(db, 'breakdown_tickets'), {
        ticketNumber,
        siteId,
        companyId: userProfile.companyId,
        machineId: machine.id,
        machineName: machine.name,
        machineDepartment: machine.department || '',
        machineLocation: machine.location || '',
        machineCriticality: machine.criticality || 3,
        severity,
        type: breakdownType,
        description: description.trim(),
        productionImpact: productionImpact.trim(),
        currentProductionCount: currentProductionCount !== '' ? Number(currentProductionCount) : null,
        attemptedFixes: attemptedFixes.trim(),
        machineStillRunning,
        photos: [],
        video: null,
        source: 'web_browser',
        reportedBy: userProfile.id,
        reporterName: userProfile.fullName,
        reporterRole: userProfile.role,
        reportedAt: serverTimestamp(),
        status: 'reported',
        statusHistory: [],
        assignedTechnicianIds: [],
        assignedTechnicianNames: [],
        assignedContractorId: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        assignedAt: null,
        enRouteAt: null,
        repairStartedAt: null,
        resolvedAt: null,
        closedAt: null,
        slaDeadline: null,
      });
      void notifyRoles(userProfile.companyId, ['supervisor', 'plant_manager', 'admin'], {
        type: 'breakdown',
        message: `${machine.name}: new ${severity} breakdown reported by ${userProfile.fullName}`,
        severity,
        linkTo: '/app/breakdowns',
      });
      navigate('/app/breakdowns', { replace: true });
    } catch (err: any) {
      console.error('Report breakdown failed:', err);
      setError(err?.message || 'Failed to report breakdown.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-1"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Report a Breakdown</h1>
        <p className="text-sm text-slate-500">
          Fast-track a machine breakdown to your maintenance team.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Machine *</label>
            {machineLocked && (
              <div className="mb-2 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <QrCode className="w-4 h-4 flex-shrink-0" />
                <span>
                  Machine selected via QR scan: <strong>{scannedMachine?.name}</strong>
                </span>
              </div>
            )}
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              disabled={machinesLoading || submitting || machineLocked}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
            >
              <option value="">
                {machinesLoading ? 'Loading machines…' : machines.length === 0 ? 'No machines yet — add one first' : 'Select a machine'}
              </option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.department ? `— ${m.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Severity *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    severity === s.value
                      ? 'border-blue-600 ring-2 ring-blue-100 bg-white'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase mr-2 ${s.color}`}>
                    {s.value}
                  </span>
                  <span className="text-slate-700">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
            <select
              value={breakdownType}
              onChange={(e) => setBreakdownType(e.target.value as BreakdownType)}
              disabled={submitting}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              What happened? *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={submitting}
              placeholder="Describe the symptoms, error codes, sounds, etc."
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Production impact</label>
            <input
              type="text"
              value={productionImpact}
              onChange={(e) => setProductionImpact(e.target.value)}
              disabled={submitting}
              placeholder="e.g., Line 2 stopped, ~500 units/hr lost"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Current production count when stopped
            </label>
            <input
              type="number"
              min={0}
              value={currentProductionCount}
              onChange={(e) => setCurrentProductionCount(e.target.value)}
              disabled={submitting}
              placeholder="0"
              className="w-48 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Attempted fixes</label>
            <input
              type="text"
              value={attemptedFixes}
              onChange={(e) => setAttemptedFixes(e.target.value)}
              disabled={submitting}
              placeholder="e.g., Restarted the controller, no change"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={machineStillRunning}
              onChange={(e) => setMachineStillRunning(e.target.checked)}
              disabled={submitting}
              className="rounded"
            />
            Machine is still running (degraded but operational)
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Breakdown'}
          </button>
        </div>
      </form>
    </div>
  );
}
