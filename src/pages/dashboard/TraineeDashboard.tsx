import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useMyJobQueue } from '../../hooks/dashboard/useMyJobQueue';
import JobQueueList from '../../components/dashboard/technician/JobQueueList';
import TodaysPmList from '../../components/dashboard/technician/TodaysPmList';
import RequestedPartsWidget from '../../components/dashboard/technician/RequestedPartsWidget';
import MyReturnablePartsWidget from '../../components/dashboard/technician/MyReturnablePartsWidget';
import UnassignedBreakdownsWidget from '../../components/dashboard/technician/UnassignedBreakdownsWidget';
import AssignedBreakdownsWidget from '../../components/dashboard/technician/AssignedBreakdownsWidget';
import MySafetyTrainingsWidget from '../../components/dashboard/technician/MySafetyTrainingsWidget';
import MySafetyCasesWidget from '../../components/dashboard/technician/MySafetyCasesWidget';
import MyTrainingsWidget from '../../components/dashboard/technician/MyTrainingsWidget';
import { CreatePartsRequestModal } from '../../components/inventory/requests/CreatePartsRequestModal';
import { TechnicianWOExecutionSheet } from '../../components/workorders/technician/TechnicianWOExecutionSheet';
import DashboardWidget from '../../components/dashboard/shared/DashboardWidget';
import EmptyState from '../../components/dashboard/shared/EmptyState';
import type { WorkOrder } from '../../types/workOrder';
import type { EvaluationSession } from '../../modules/evaluation/types/evaluation.types';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function useMyRecentEvaluations(userId: string, limitCount = 3) {
  const [evaluations, setEvaluations] = useState<EvaluationSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'evaluations'),
      where('evaluateeId', '==', userId),
      where('status', '==', 'submitted'),
      limit(limitCount),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as EvaluationSession))
          .sort((a, b) => (b.evaluationDate > a.evaluationDate ? 1 : -1));
        setEvaluations(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [userId, limitCount]);

  return { evaluations, loading };
}

// Mirrors TechnicianDashboard's job-queue + execution-sheet workflow, so a
// trainee can start/hold/complete their own assigned work orders the same
// way a technician does (see useMyJobQueue / firestore.rules — trainees are
// already authorized the same as technicians on assigned WOs). The "My
// Evaluations" section below is trainee-specific, kept from the previous
// read-only dashboard.
export default function TraineeDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  // Match the security rule, which authorizes assigned-WO reads on
  // `request.auth.uid` — query on the auth uid, not the profile id.
  const traineeId = user?.uid ?? userProfile?.id ?? '';
  const siteId = userProfile?.siteIds?.[0] ?? userProfile?.companyId ?? '';
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'Trainee';
  const [showPartsRequest, setShowPartsRequest] = useState(false);
  const [partsRequestWO, setPartsRequestWO] = useState<WorkOrder | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { workOrders, loading } = useMyJobQueue(traineeId, siteId);
  const { evaluations, loading: evalLoading } = useMyRecentEvaluations(traineeId);

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
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">{t('common.dashboard.traineeTitle')}</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          {t('common.dashboard.greeting.text', { time: t(`common.dashboard.greeting.${getGreeting()}`), name: firstName })}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <JobQueueList
          technicianId={traineeId}
          siteId={siteId}
          onSelect={(wo) => setSelectedId(wo.id)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UnassignedBreakdownsWidget siteId={siteId} />
          <AssignedBreakdownsWidget technicianId={traineeId} siteId={siteId} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodaysPmList technicianId={traineeId} siteId={siteId} onSelect={(woId) => setSelectedId(woId)} />
          <RequestedPartsWidget onRequestParts={() => openPartsRequest(null)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MyReturnablePartsWidget />
          <MyTrainingsWidget />
        </div>

        <MySafetyTrainingsWidget />

        <MySafetyCasesWidget />

        {/* My Evaluations — trainee-specific */}
        <DashboardWidget title={t('common.widgets.traineeDashboard.myEvaluations')} loading={evalLoading}>
          {evaluations.length === 0 ? (
            <EmptyState message={t('common.widgets.traineeDashboard.noEvaluations')} />
          ) : (
            <div className="space-y-2">
              {evaluations.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[#0A1628] border border-[#1E3A5F] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F0F4F8]">{ev.evaluationDate}</p>
                    {ev.templateName && (
                      <p className="text-xs text-[#8BA3BF] truncate">{ev.templateName}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-[#00C2FF]">{ev.overallScore}%</span>
                </div>
              ))}
            </div>
          )}
        </DashboardWidget>
      </div>

      {selectedWO && (
        <TechnicianWOExecutionSheet workOrder={selectedWO} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
