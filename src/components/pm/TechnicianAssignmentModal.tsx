import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { useShiftConfig } from '../../hooks/useShiftConfig';
import { useCompanyTechnicians } from '../../hooks/pm/useCompanyTechnicians';
import { queryTechnicianDayJobs, addJobTechnician } from '../../services/scheduler.service';
import {
  shiftCapacityHours,
  detectConflict,
  type SchedulableJob,
  type ConflictResult,
} from '../../lib/pm/schedulerConflict';

interface TechnicianAssignmentModalProps {
  job: SchedulableJob;
  onClose: () => void;
  onOpenRecord?: () => void;
}

export function TechnicianAssignmentModal({
  job,
  onClose,
  onOpenRecord,
}: TechnicianAssignmentModalProps) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { technicians } = useCompanyTechnicians(companyId);
  const { shifts } = useShiftConfig();
  const capacityHours = shiftCapacityHours(shifts);

  const [techId, setTechId] = useState('');
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-run the conflict check whenever the selected technician changes,
  // querying that technician's other jobs that day via the composite index.
  useEffect(() => {
    setConflict(null);
    setConfirmed(false);
    if (!techId || !companyId) return;
    let cancelled = false;
    setChecking(true);
    (async () => {
      try {
        const dayJobs = await queryTechnicianDayJobs(companyId, techId, job.date);
        if (cancelled) return;
        setConflict(
          detectConflict({
            technicianId: techId,
            date: job.date,
            addedHours: job.estimatedHours,
            existingJobs: dayJobs,
            capacityHours,
            excludeJobId: job.id,
          }),
        );
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [techId, companyId, job, capacityHours]);

  const isDoubleBooked = conflict?.isDoubleBooked ?? false;
  const alreadyAssigned = job.assignedTechnicianIds.includes(techId);
  const canSave =
    !!techId && !checking && !alreadyAssigned && (!isDoubleBooked || confirmed);

  const handleSave = useCallback(async () => {
    if (!techId) return;
    const tech = technicians.find((t) => t.id === techId);
    if (!tech) return;
    setSaving(true);
    try {
      await addJobTechnician(job, techId, tech.name);
      toast.success(`Assigned ${tech.name} to “${job.title}”`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign technician');
    } finally {
      setSaving(false);
    }
  }, [techId, technicians, job, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">Assign Technician</h3>
            <p className="text-xs text-gray-500 truncate">
              {job.title} • {job.machineName} • {job.date.toLocaleDateString()} • {job.estimatedHours}h
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {job.assignedTechnicianNames.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Currently assigned
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.assignedTechnicianNames.map((n, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add technician</label>
            <select
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Select a technician…</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {checking && <p className="text-xs text-gray-400">Checking schedule…</p>}

          {alreadyAssigned && (
            <p className="text-xs text-amber-600">This technician is already assigned to the job.</p>
          )}

          {conflict && !alreadyAssigned && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                isDoubleBooked
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {isDoubleBooked ? (
                <>
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-4 h-4" /> Double-booked
                  </p>
                  <p className="text-xs mt-1">
                    {conflict.totalHours}h would be booked vs {conflict.capacityHours}h capacity
                    ({conflict.conflictingJobs.length} other job
                    {conflict.conflictingJobs.length === 1 ? '' : 's'} that day).
                  </p>
                  <label className="flex items-center gap-2 mt-2 text-xs text-red-800">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    I understand and want to assign anyway
                  </label>
                </>
              ) : (
                <p className="text-xs">
                  Within capacity: {conflict.totalHours}h / {conflict.capacityHours}h booked.
                </p>
              )}
            </div>
          )}

          {onOpenRecord && (
            <button
              type="button"
              onClick={onOpenRecord}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open record
            </button>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`flex-1 px-4 py-2 font-semibold rounded-lg text-sm text-white disabled:opacity-50 ${
              isDoubleBooked ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Assigning…' : isDoubleBooked ? 'Assign anyway' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
