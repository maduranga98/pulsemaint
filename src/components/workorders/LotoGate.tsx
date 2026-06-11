import { Lock, LockOpen, ShieldCheck, AlertTriangle, Zap, Droplets, Wind, Settings, Flame } from 'lucide-react';
import { usePermit } from '../../hooks/usePermit';
import { useAuthStore } from '../../store/authStore';
import type { WorkOrder } from '../../types/workOrder';
import type { IsolationPoint, IsolationPointType } from '../../types/machine';
import { format } from 'date-fns';

interface LotoGateProps {
  workOrder: WorkOrder;
  machineIsolationPoints: IsolationPoint[];
}

const TYPE_COLORS: Record<IsolationPointType, string> = {
  electrical: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hydraulic: 'bg-blue-100 text-blue-700 border-blue-200',
  pneumatic: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  mechanical: 'bg-gray-100 text-gray-700 border-gray-200',
  thermal: 'bg-red-100 text-red-700 border-red-200',
};

function IsolationTypeIcon({ type }: { type: IsolationPointType }) {
  const cls = 'h-4 w-4';
  switch (type) {
    case 'electrical': return <Zap className={cls} />;
    case 'hydraulic': return <Droplets className={cls} />;
    case 'pneumatic': return <Wind className={cls} />;
    case 'mechanical': return <Settings className={cls} />;
    case 'thermal': return <Flame className={cls} />;
  }
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(date, 'MMM d, HH:mm');
  } catch {
    return '';
  }
}

export function LotoGate({ workOrder, machineIsolationPoints }: LotoGateProps) {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = (userProfile?.role ?? '') as string;
  const isSupervisorRole = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'].includes(role);

  const {
    permit,
    loading,
    allPointsLocked,
    lotoGatePassed,
    createPermit,
    lockPoint,
    unlockPoint,
    verifyZeroEnergy,
    issuePermit,
  } = usePermit({
    workOrderId: workOrder.id,
    machineId: workOrder.machineId,
    siteId: workOrder.siteId,
  });

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">Loading safety gate...</div>
    );
  }

  const uid = user?.uid ?? '';
  const userName = user?.displayName ?? userProfile?.id ?? '';

  // Status banner config
  let bannerBg = 'bg-red-50 border-red-200 text-red-700';
  let bannerIcon = <AlertTriangle className="h-5 w-5" />;
  let bannerText = 'LOTO/PTW not initialized';

  if (permit) {
    const lockedCount = permit.isolationChecklist.filter((e) => e.locked).length;
    const total = permit.isolationChecklist.length;

    if (lotoGatePassed) {
      bannerBg = 'bg-emerald-50 border-emerald-200 text-emerald-700';
      bannerIcon = <ShieldCheck className="h-5 w-5" />;
      bannerText = 'Safety gate PASSED — work may proceed';
    } else if (permit.zeroEnergyVerified && !lotoGatePassed && workOrder.ptwCategory) {
      bannerBg = 'bg-blue-50 border-blue-200 text-blue-700';
      bannerIcon = <ShieldCheck className="h-5 w-5" />;
      bannerText = 'Zero energy verified — PTW permit issuance pending';
    } else if (allPointsLocked && !permit.zeroEnergyVerified) {
      bannerBg = 'bg-orange-50 border-orange-200 text-orange-700';
      bannerIcon = <Lock className="h-5 w-5" />;
      bannerText = 'All points locked — verify zero energy state';
    } else if (lockedCount > 0 && lockedCount < total) {
      bannerBg = 'bg-yellow-50 border-yellow-200 text-yellow-700';
      bannerIcon = <AlertTriangle className="h-5 w-5" />;
      bannerText = `Isolation in progress — ${lockedCount}/${total} points locked`;
    } else if (lockedCount === 0) {
      bannerBg = 'bg-red-50 border-red-200 text-red-700';
      bannerIcon = <AlertTriangle className="h-5 w-5" />;
      bannerText = 'Isolation not started — lock all points before proceeding';
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-medium text-sm ${bannerBg}`}>
        {bannerIcon}
        <span>{bannerText}</span>
      </div>

      {/* No isolation points defined */}
      {machineIsolationPoints.length === 0 && !permit && (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
          No isolation points defined for this machine. Add them in the machine profile.
        </div>
      )}

      {/* Initialize button */}
      {!permit && machineIsolationPoints.length > 0 && (
        <button
          type="button"
          onClick={() => createPermit(machineIsolationPoints)}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Initialize LOTO/PTW
        </button>
      )}

      {/* Isolation Points List */}
      {permit && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Isolation Points</h3>
          {permit.isolationChecklist.length === 0 && (
            <p className="text-sm text-gray-400 py-2">No isolation points in this permit.</p>
          )}
          {permit.isolationChecklist.map((entry) => {
            const pointDef = machineIsolationPoints.find((p) => p.id === entry.pointId);
            const typeLabel = pointDef?.type ?? 'unknown';
            const label = pointDef?.label ?? entry.pointId;
            const location = pointDef?.location ?? '';

            return (
              <div
                key={entry.pointId}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  entry.locked ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                {/* Type badge */}
                <span
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 mt-0.5 ${
                    TYPE_COLORS[typeLabel as IsolationPointType] ?? TYPE_COLORS.mechanical
                  }`}
                >
                  <IsolationTypeIcon type={typeLabel as IsolationPointType} />
                  {typeLabel}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  {location && <p className="text-xs text-gray-500">{location}</p>}
                  {entry.locked && entry.lockedByName && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Locked by {entry.lockedByName}
                      {entry.lockedAt && ` · ${formatTimestamp(entry.lockedAt)}`}
                    </p>
                  )}
                </div>

                {/* Lock state icon */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {entry.locked ? (
                    <Lock className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <LockOpen className="h-5 w-5 text-gray-400" />
                  )}

                  {/* Action buttons */}
                  {!entry.locked && (
                    <button
                      type="button"
                      onClick={() => lockPoint(entry.pointId, uid, userName)}
                      className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Lock
                    </button>
                  )}
                  {entry.locked && isSupervisorRole && (
                    <button
                      type="button"
                      onClick={() => unlockPoint(entry.pointId)}
                      className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Unlock
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Zero Energy Verification */}
      {permit && (
        <div className={`rounded-xl border px-4 py-3 space-y-1 ${
          permit.zeroEnergyVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <label className={`flex items-center gap-2 cursor-pointer ${!allPointsLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              checked={permit.zeroEnergyVerified}
              disabled={!allPointsLocked || permit.zeroEnergyVerified}
              onChange={() => {
                if (allPointsLocked && !permit.zeroEnergyVerified) {
                  verifyZeroEnergy(uid, userName);
                }
              }}
              className="rounded border-gray-300 text-emerald-600"
            />
            <span className="text-sm font-medium text-gray-800">Zero Energy State Verified</span>
            <ShieldCheck className={`h-4 w-4 ${permit.zeroEnergyVerified ? 'text-emerald-500' : 'text-gray-300'}`} />
          </label>
          {!allPointsLocked && (
            <p className="text-xs text-gray-400 ml-6">Lock all isolation points first</p>
          )}
          {permit.zeroEnergyVerified && permit.zeroEnergyVerifiedByName && (
            <p className="text-xs text-emerald-600 ml-6">
              Verified by {permit.zeroEnergyVerifiedByName}
              {permit.zeroEnergyVerifiedAt && ` · ${formatTimestamp(permit.zeroEnergyVerifiedAt)}`}
            </p>
          )}
        </div>
      )}

      {/* PTW Section */}
      {permit && workOrder.ptwCategory && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Permit to Work</p>
              <p className="font-semibold text-gray-900">{workOrder.ptwCategory}</p>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                permit.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700'
                  : permit.status === 'closed'
                  ? 'bg-gray-100 text-gray-600'
                  : permit.status === 'cancelled'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {permit.status.toUpperCase()}
            </span>
          </div>

          {permit.status === 'active' && permit.issuedByName && (
            <p className="text-xs text-emerald-700">
              Issued by {permit.issuedByName}
              {permit.issuedAt && ` · ${formatTimestamp(permit.issuedAt)}`}
            </p>
          )}

          {isSupervisorRole && permit.status === 'draft' && permit.zeroEnergyVerified && (
            <button
              type="button"
              onClick={() => issuePermit(uid, userName)}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
            >
              Issue Permit
            </button>
          )}

          {!permit.zeroEnergyVerified && (
            <p className="text-xs text-gray-500">Zero energy verification required before permit can be issued.</p>
          )}
        </div>
      )}
    </div>
  );
}
