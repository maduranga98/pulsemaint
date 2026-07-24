import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMyJobQueue } from '../../hooks/dashboard/useMyJobQueue';
import ActiveJobCard from '../../components/dashboard/technician/ActiveJobCard';
import JobQueueList from '../../components/dashboard/technician/JobQueueList';
import TodaysPmList from '../../components/dashboard/technician/TodaysPmList';
import PersonalKpiCards from '../../components/dashboard/technician/PersonalKpiCards';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import { CreatePartsRequestModal } from '../../components/inventory/requests/CreatePartsRequestModal';
import { TechnicianWOExecutionSheet } from '../../components/workorders/technician/TechnicianWOExecutionSheet';
import type { WorkOrder } from '../../types/workOrder';

export default function TechnicianDashboard() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  // Match the security rule, which authorizes assigned-WO reads on
  // `request.auth.uid` — query on the auth uid, not the profile id.
  const technicianId = user?.uid ?? userProfile?.id ?? '';
  // WO creation falls back to companyId when the creator has no siteIds
  // (useCreateWorkOrder), so the queue query must use the same fallback or
  // assigned WOs never match (same rule as MyWorkOrdersPage).
  const siteId = userProfile?.siteIds?.[0] ?? userProfile?.companyId ?? '';
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'Technician';
  const [showPartsRequest, setShowPartsRequest] = useState(false);
  const [partsRequestWO, setPartsRequestWO] = useState<WorkOrder | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { workOrders, loading } = useMyJobQueue(technicianId, siteId);

  // Find active job (IN_PROGRESS)
  const activeJob = workOrders.find((wo) => wo.status === 'IN_PROGRESS') ?? null;

  // Re-derive selected WO from the live list so the execution sheet updates
  // in realtime and auto-closes when the WO leaves the active queue.
  const selectedWO = useMemo(
    () => workOrders.find((w) => w.id === selectedId) ?? null,
    [workOrders, selectedId],
  );

  useEffect(() => {
    if (selectedId && !loading && !selectedWO) setSelectedId(null);
  }, [selectedId, selectedWO, loading]);

  function openPartsRequest(wo: WorkOrder | null) {
    setPartsRequestWO(wo);
    setShowPartsRequest(true);
  }

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      {showPartsRequest && (
        <CreatePartsRequestModal
          onClose={() => {
            setShowPartsRequest(false);
            setPartsRequestWO(null);
          }}
          workOrder={
            partsRequestWO
              ? {
                  id: partsRequestWO.id,
                  woNumber: partsRequestWO.woNumber,
                  woType: partsRequestWO.woType,
                  machineId: partsRequestWO.machineId,
                  machineName: partsRequestWO.machineName,
                  isContractorJob: partsRequestWO.woType === 'CONTRACTOR',
                  contractorCompany: partsRequestWO.contractorCompanyName ?? null,
                }
              : undefined
          }
        />
      )}

      <div className="px-4 py-4 sm:px-6 lg:px-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Technician Dashboard</h1>
          <p className="text-sm text-[#8BA3BF] mt-0.5">
            Good {getGreeting()}, {firstName}
          </p>
        </div>
        <button
          onClick={() => openPartsRequest(activeJob)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
        >
          + Request Parts
        </button>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* Active Job */}
        <ActiveJobCard
          workOrder={activeJob}
          onOpen={(wo) => setSelectedId(wo.id)}
          onRequestParts={(wo) => openPartsRequest(wo)}
        />

        {/* Job Queue */}
        <JobQueueList
          technicianId={technicianId}
          siteId={siteId}
          onSelect={(wo) => setSelectedId(wo.id)}
        />

        {/* Bottom row: PM + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodaysPmList technicianId={technicianId} siteId={siteId} />
          <PersonalKpiCards technicianId={technicianId} siteId={siteId} />
        </div>
      </div>

      {selectedWO && (
        <TechnicianWOExecutionSheet workOrder={selectedWO} onClose={() => setSelectedId(null)} />
      )}

      <DashboardSidePanel />
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
