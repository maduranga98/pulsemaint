import type { Breakdown, BreakdownStatus } from '../../types/breakdown';

const ROLE_LABELS: Record<string, string> = {
  technician: 'Technician', trainee: 'Trainee', supervisor: 'Supervisor',
  maintenance_supervisor: 'Supervisor', plant_manager: 'Plant Manager',
  store_keeper: 'Store Keeper', floor_operator: 'Floor Operator',
  hr_officer: 'HR Officer', safety_officer: 'Safety Officer', admin: 'Admin',
};
function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

// Some older records have a role already baked into the stored name itself
// (e.g. "Julia (Trainee)") from before role display was resolved live —
// strip any trailing "(...)" before appending the freshly-resolved role so
// it never doubles up as "Julia (Trainee) (Trainee)".
function stripRoleSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export const STATUS_LABEL: Record<BreakdownStatus, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  triage_in_progress: 'In Triage',
  assigned: 'Assigned',
  en_route: 'En Route',
  repair_in_progress: 'In Progress',
  on_hold_parts: 'On Hold (Parts)',
  on_hold_approval: 'On Hold (Approval)',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<BreakdownStatus, string> = {
  reported: 'bg-red-50 text-red-700 ring-red-200',
  acknowledged: 'bg-amber-50 text-amber-700 ring-amber-200',
  triage_in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  en_route: 'bg-blue-50 text-blue-700 ring-blue-200',
  repair_in_progress: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  on_hold_parts: 'bg-orange-50 text-orange-700 ring-orange-200',
  on_hold_approval: 'bg-orange-50 text-orange-700 ring-orange-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  cancelled: 'bg-slate-200 text-slate-700 ring-slate-300',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

interface Props {
  breakdown: Breakdown;
  /** uid -> role, resolved from the users collection. */
  actorRoles: Record<string, string>;
  /** Shows the ticket number as a heading — off by default when the caller
   *  (e.g. a group view) already shows it elsewhere. */
  showTicketHeading?: boolean;
}

/** Full breakdown detail — everything filled from report through repair —
 *  plus its complete status history. Shared by the single-ticket view and
 *  the machine group view so both show identical, complete data. */
export function BreakdownDetailCard({ breakdown: b, actorRoles, showTicketHeading = false }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        {showTicketHeading && (
          <h2 className="font-bold text-lg text-slate-900">{b.ticketNumber}</h2>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {b.severity ? (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${SEVERITY_COLOR[b.severity]}`}>
              {b.severity}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Pending assessment</span>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_COLOR[b.status]}`}>
            {STATUS_LABEL[b.status]}
          </span>
          {b.type && <span className="text-xs text-slate-500 capitalize">{b.type}</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Machine</p>
            <p className="text-slate-900 font-medium">{b.machineName}</p>
            {b.machineLocation && <p className="text-slate-500 text-xs">{b.machineLocation}</p>}
            {b.machineDepartment && <p className="text-slate-500 text-xs">{b.machineDepartment}</p>}
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Reported</p>
            <p className="text-slate-900 font-medium capitalize">{b.source?.replace(/_/g, ' ') || 'Web'}</p>
            <p className="text-slate-500 text-xs">
              {b.reportedAt?.toDate ? b.reportedAt.toDate().toLocaleString() : ''}
            </p>
          </div>
        </div>

        {b.attendedByName && (
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Attended By</p>
            <p className="text-slate-800 text-sm">
              {stripRoleSuffix(b.attendedByName)}
              {b.attendedBy && actorRoles[b.attendedBy] && (
                <span className="text-slate-500"> ({roleLabel(actorRoles[b.attendedBy])})</span>
              )}
              {b.attendedAt?.toDate && (
                <span className="text-slate-500 text-xs ml-2">{b.attendedAt.toDate().toLocaleString()}</span>
              )}
            </p>
          </div>
        )}

        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">What Happened</p>
          <p className="text-slate-800 text-sm">{b.description || ''}</p>
        </div>

        {b.productionImpact && (
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Production Impact</p>
            <p className="text-slate-800 text-sm">{b.productionImpact}</p>
          </div>
        )}

        {b.attemptedFixes && (
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Attempted Fixes</p>
            <p className="text-slate-800 text-sm">{b.attemptedFixes}</p>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          <span className={`px-2 py-1 rounded text-xs font-medium ${b.machineStillRunning ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {b.machineStillRunning ? 'Machine still running (degraded)' : 'Machine stopped'}
          </span>
        </div>

        {(b.assignedTechnicianNames ?? []).length > 0 && (
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Assigned Technicians</p>
            <p className="text-slate-800 text-sm">
              {b.assignedTechnicianNames
                .map((name, i) => {
                  const base = stripRoleSuffix(name);
                  const id = b.assignedTechnicianIds?.[i];
                  const role = id ? actorRoles[id] : undefined;
                  return role ? `${base} (${roleLabel(role)})` : base;
                })
                .join(', ')}
            </p>
          </div>
        )}

        {(b.photos ?? []).length > 0 && (
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Attached Media</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {b.photos.map((url, i) => {
                const isImage = /\.(jpe?g|png|gif|webp|heic|bmp)(\?|$)/i.test(url);
                const isVideo = /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-slate-200 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-300 transition-shadow"
                  >
                    {isImage ? (
                      <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-24 object-cover" />
                    ) : isVideo ? (
                      <video src={url} className="w-full h-24 object-cover" muted />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                        File {i + 1}
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Status History</p>
        {(b.statusHistory ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No status changes yet.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {(b.statusHistory ?? []).map((h: any, idx: number) => (
              <li key={idx} className="flex gap-3 items-start">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-50 border border-slate-200 whitespace-nowrap">
                  {STATUS_LABEL[h.status as BreakdownStatus] ?? h.status}
                </span>
                <div>
                  <span className="text-slate-700">
                    {stripRoleSuffix(h.changedByName ?? '')}
                    {h.changedBy && actorRoles[h.changedBy] && (
                      <span className="text-slate-500"> ({roleLabel(actorRoles[h.changedBy])})</span>
                    )}
                  </span>
                  <span className="text-slate-400 text-xs ml-2">
                    {h.changedAt?.toDate ? h.changedAt.toDate().toLocaleString() : (typeof h.changedAt === 'string' ? new Date(h.changedAt).toLocaleString() : '')}
                  </span>
                  {h.note && <p className="text-slate-500 text-xs italic mt-0.5">{h.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
