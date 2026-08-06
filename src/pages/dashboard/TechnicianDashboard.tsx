import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMyJobQueue } from '../../hooks/dashboard/useMyJobQueue';
import JobQueueList from '../../components/dashboard/technician/JobQueueList';
import TodaysPmList from '../../components/dashboard/technician/TodaysPmList';
import RequestedPartsWidget from '../../components/dashboard/technician/RequestedPartsWidget';
import UnassignedBreakdownsWidget from '../../components/dashboard/technician/UnassignedBreakdownsWidget';
import AssignedBreakdownsWidget from '../../components/dashboard/technician/AssignedBreakdownsWidget';
import MySafetyTrainingsWidget from '../../components/dashboard/technician/MySafetyTrainingsWidget';
import MySafetyCasesWidget from '../../components/dashboard/technician/MySafetyCasesWidget';
import MyTrainingsWidget from '../../components/dashboard/technician/MyTrainingsWidget';
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

      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Technician Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <JobQueueList
          technicianId={technicianId}
          siteId={siteId}
          onSelect={(wo) => setSelectedId(wo.id)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UnassignedBreakdownsWidget siteId={siteId} />
          <AssignedBreakdownsWidget technicianId={technicianId} siteId={siteId} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodaysPmList technicianId={technicianId} siteId={siteId} onSelect={(woId) => setSelectedId(woId)} />
          <RequestedPartsWidget onRequestParts={() => openPartsRequest(null)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MySafetyTrainingsWidget />
          <MyTrainingsWidget />
        </div>

        <MySafetyCasesWidget />
      </div>

      {selectedWO && (
        <TechnicianWOExecutionSheet workOrder={selectedWO} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
