import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuthStore } from '../../store/authStore';
import { useMachine } from '../../hooks/useMachine';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { MachineStatusBadge, MachineCriticalityBadge, MachineHealthScore } from '../../components/machines';
import { formatDate } from '../../lib/dateUtils';
import { exportMachineDetailsPdf, formatMachineTypeLabel } from '../../lib/machineExport';
import { MachineHistoryTimeline } from '../../components/workorders/MachineHistoryTimeline';
import { BreakdownHistoryList } from '../../components/machines/BreakdownHistoryList';
import { DowntimeCostFields } from '../../components/machines/DowntimeCostFields';
import type { WOType } from '../../types/workOrder';

type TabName = 'overview' | 'documents' | 'history' | 'maintenance' | 'analytics';

export function MachineProfilePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const [activeTab, setActiveTab] = useState<TabName>('overview');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';
  const { machine, loading, error } = useMachine({ siteId, machineId: id ?? '' });

  if (!userProfile || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('common.machines.profilePage.loading')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('common.machines.profilePage.loadingDetails')}</p>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('common.machines.profilePage.notFound')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/app/machines')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('common.machines.profilePage.backToRegistry')}
          </button>
        </div>
      </div>
    );
  }

  const canEditMachine =
    userProfile.role === 'supervisor' || userProfile.role === 'plant_manager' || userProfile.role === 'admin';

  const tabs: { name: TabName; label: string }[] = [
    { name: 'overview', label: t('common.machines.profilePage.tabs.overview') },
    { name: 'documents', label: t('common.machines.profilePage.tabs.documents') },
    { name: 'history', label: t('common.machines.profilePage.tabs.history') },
    { name: 'maintenance', label: t('common.machines.profilePage.tabs.maintenance') },
    { name: 'analytics', label: t('common.machines.profilePage.tabs.analytics') },
  ];

  const analyticsTabDisabled = userProfile.role !== 'plant_manager' && userProfile.role !== 'admin';

  return (
    <div className="min-h-full">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{machine.name}</h1>
              <p className="text-gray-600 text-sm mt-1">
                {t('common.machines.profilePage.modelSerial', { model: machine.model, serial: machine.serialNumber })}
              </p>
              <p className="text-gray-600 text-sm">
                {machine.department}
                {machine.floor && ` · Floor ${machine.floor}`}
                {machine.bay && ` · Bay ${machine.bay}`}
                {machine.station && ` · Station ${machine.station}`}
              </p>
            </div>

            <div className="flex gap-2">
              <MachineStatusBadge status={machine.status} size="lg" />
              <MachineCriticalityBadge criticality={machine.criticality} size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Health Score Banner */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <MachineHealthScore score={machine.healthScore} variant="gauge" />
            </div>
            <div className="text-sm">
              <p className="text-gray-600 mb-2">
                <span className="font-medium">{t('common.machines.profilePage.lastService')}</span> {
                  machine.lastServiceDate
                    ? formatDate(machine.lastServiceDate.toDate?.() || new Date((machine.lastServiceDate as any).seconds * 1000))
                    : t('common.machines.profilePage.never')
                }
              </p>
              <p className="text-gray-600">
                <span className="font-medium">{t('common.machines.profilePage.lastServiceType')}</span> {machine.lastServiceType || t('common.machines.profilePage.notAvailable')}
              </p>
            </div>
            <div className="text-sm">
              {machine.nextPmDue ? (
                <>
                  <p className="text-gray-600 mb-2">
                    <span className="font-medium">{t('common.machines.profilePage.nextPmDue')}</span> {formatDate(machine.nextPmDue.toDate?.() || new Date((machine.nextPmDue as any).seconds * 1000))}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">{t('common.machines.profilePage.daysRemaining')}</span> {t('common.machines.profilePage.daysRemainingPlaceholder')}
                  </p>
                </>
              ) : (
                <p className="text-gray-600">
                  <span className="font-medium">{t('common.machines.profilePage.nextPm')}</span> {t('common.machines.profilePage.notScheduled')}
                </p>
              )}
            </div>
          </div>

          {canEditMachine && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => navigate(`/app/machines/${machine.id}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                {t('common.machines.profilePage.editMachine')}
              </button>
              <button
                onClick={() => navigate(`/app/machines/${machine.id}/qr`)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                {t('common.machines.profilePage.viewQrCode')}
              </button>
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu((v) => !v)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  {t('common.machines.profilePage.more')}
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                    <button
                      onClick={() => { navigate(`/app/work-orders?create=1&machineId=${machine.id}`); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('common.machines.profilePage.createWorkOrder')}
                    </button>
                    <button
                      onClick={() => { navigate(`/app/breakdowns/report?machineId=${machine.id}`); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('common.machines.profilePage.reportIssue')}
                    </button>
                    <button
                      onClick={() => { exportMachineDetailsPdf(machine); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('common.machines.profilePage.exportDetailsPdf')}
                    </button>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={() => { navigate(`/app/machines/${machine.id}/edit?action=decommission`); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      {t('common.machines.profilePage.decommissionMachine')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 border-b border-gray-200 bg-white overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => {
                if (tab.name !== 'analytics' || !analyticsTabDisabled) {
                  setActiveTab(tab.name);
                }
              }}
              disabled={tab.name === 'analytics' && analyticsTabDisabled}
              className={`shrink-0 whitespace-nowrap px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.name
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              } ${tab.name === 'analytics' && analyticsTabDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' && <OverviewTab machine={machine} canEdit={canEditMachine} />}
        {activeTab === 'documents' && <DocumentsTab machine={machine} />}
        {activeTab === 'history' && <HistoryTab machine={machine} />}
        {activeTab === 'maintenance' && <MaintenanceTab machine={machine} />}
        {activeTab === 'analytics' && <AnalyticsTab machine={machine} />}
      </div>
    </div>
  );
}

// Tab Components
function OverviewTab({ machine, canEdit }: any) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Machine Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('common.machines.profilePage.overview.detailsTitle')}</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.name')}</dt>
            <dd className="font-medium text-gray-900">{machine.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.type')}</dt>
            <dd className="font-medium text-gray-900">{formatMachineTypeLabel(machine.type)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.manufacturer')}</dt>
            <dd className="font-medium text-gray-900">{machine.manufacturer}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.model')}</dt>
            <dd className="font-medium text-gray-900">{machine.model || t('common.machines.profilePage.notAvailable')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.serialNumber')}</dt>
            <dd className="font-medium text-gray-900">{machine.serialNumber || t('common.machines.profilePage.notAvailable')}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-3">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.purchaseDate')}</dt>
            <dd className="font-medium text-gray-900">
              {machine.purchaseDate ? formatDate(machine.purchaseDate.toDate?.() || new Date((machine.purchaseDate as any).seconds * 1000)) : t('common.machines.profilePage.notAvailable')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.installationDate')}</dt>
            <dd className="font-medium text-gray-900">
              {machine.installationDate ? formatDate(machine.installationDate.toDate?.() || new Date((machine.installationDate as any).seconds * 1000)) : t('common.machines.profilePage.notAvailable')}
            </dd>
          </div>
        </dl>
      </div>

      {/* Location */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('common.machines.profilePage.overview.locationTitle')}</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.department')}</dt>
            <dd className="font-medium text-gray-900">{machine.department}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.floor')}</dt>
            <dd className="font-medium text-gray-900">{machine.floor || t('common.machines.profilePage.notAvailable')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.bay')}</dt>
            <dd className="font-medium text-gray-900">{machine.bay || t('common.machines.profilePage.notAvailable')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">{t('common.machines.profilePage.overview.station')}</dt>
            <dd className="font-medium text-gray-900">{machine.station || t('common.machines.profilePage.notAvailable')}</dd>
          </div>
        </dl>
      </div>

      {/* Status & Health */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('common.machines.profilePage.overview.statusHealthTitle')}</h3>
        <div className="space-y-4">
          <div>
            <p className="text-gray-600 text-sm mb-2">{t('common.machines.profilePage.overview.status')}</p>
            <MachineStatusBadge status={machine.status} size="md" />
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-2">{t('common.machines.profilePage.overview.criticality')}</p>
            <MachineCriticalityBadge criticality={machine.criticality} size="md" />
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-2">{t('common.machines.profilePage.overview.healthScore')}</p>
            <MachineHealthScore score={machine.healthScore} variant="bar" />
          </div>
        </div>
      </div>

      {/* Warranty */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('common.machines.profilePage.overview.warrantyTitle')}</h3>
        {machine.warrantyItems && machine.warrantyItems.length > 0 ? (
          <ul className="space-y-2">
            {machine.warrantyItems.map((item: any, idx: number) => (
              <li key={idx} className="text-sm">
                <p className="font-medium text-gray-900">{item.partName}</p>
                <p className="text-gray-600">{t('common.machines.profilePage.overview.warrantyExpires', { date: formatDate(item.expiryDate.toDate?.() || new Date((item.expiryDate as any).seconds * 1000)) })}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 text-sm">{t('common.machines.profilePage.overview.warrantyEmpty')}</p>
        )}
      </div>

      {/* Downtime Cost */}
      <DowntimeCostFields machine={machine} canEdit={canEdit} />
    </div>
  );
}

function DocumentsTab({ machine }: any) {
  const { t } = useTranslation();
  const photos: string[] = machine.photos ?? [];
  const documents: any[] = machine.documents ?? [];
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('common.machines.profilePage.documentsTab.photosTitle')}</h3>
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noreferrer" className="block group">
                <img
                  src={url}
                  alt={t('common.machines.profilePage.documentsTab.photoAlt', { index: idx + 1 })}
                  className="aspect-square rounded-lg object-cover w-full border border-gray-200 group-hover:opacity-90 transition"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">{t('common.machines.profilePage.documentsTab.photosEmpty')}</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('common.machines.profilePage.documentsTab.documentsTitle')}</h3>
        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc: any, idx: number) => (
              <div key={idx} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-600">{doc.type}</p>
                </div>
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  {t('common.machines.profilePage.documentsTab.download')}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">{t('common.machines.profilePage.documentsTab.documentsEmpty')}</p>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ machine }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <BreakdownHistoryList machineId={machine.id} machineName={machine.name} />
    </div>
  );
}

function MaintenanceTab({ machine }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <MachineHistoryTimeline machineId={machine.id} machineName={machine.name} />
    </div>
  );
}

const COMPLETED_STATUSES = new Set(['COMPLETED', 'SIGNED_OFF', 'CLOSED']);

function AnalyticsTab({ machine }: any) {
  const { t } = useTranslation();
  const WO_TYPE_LABELS: Record<WOType, string> = {
    BREAKDOWN: t('common.machines.profilePage.analytics.woTypeLabels.BREAKDOWN'),
    CORRECTIVE: t('common.machines.profilePage.analytics.woTypeLabels.CORRECTIVE'),
    PREVENTIVE: t('common.machines.profilePage.analytics.woTypeLabels.PREVENTIVE'),
    INSTALLATION: t('common.machines.profilePage.analytics.woTypeLabels.INSTALLATION'),
    MODIFICATION: t('common.machines.profilePage.analytics.woTypeLabels.MODIFICATION'),
    INSPECTION: t('common.machines.profilePage.analytics.woTypeLabels.INSPECTION'),
    CONTRACTOR: t('common.machines.profilePage.analytics.woTypeLabels.CONTRACTOR'),
    OTHER: t('common.machines.profilePage.analytics.woTypeLabels.OTHER'),
  };
  // All-time — no date range filter, matching "all time total" from the request.
  const { workOrders, loading } = useWorkOrders({ machineId: machine.id });

  const byType = useMemo(() => {
    const counts: Record<string, { type: string; total: number; completed: number }> = {};
    for (const wo of workOrders) {
      const key = wo.woType ?? 'OTHER';
      if (!counts[key]) counts[key] = { type: WO_TYPE_LABELS[key as WOType] ?? key, total: 0, completed: 0 };
      counts[key].total += 1;
      if (COMPLETED_STATUSES.has(wo.status)) counts[key].completed += 1;
    }
    return Object.values(counts).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrders]);

  const totalWOs = workOrders.length;
  const totalCompleted = workOrders.filter((wo) => COMPLETED_STATUSES.has(wo.status)).length;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500 text-sm">{t('common.machines.profilePage.analytics.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('common.machines.profilePage.analytics.allTimeTitle')}</h3>
        <p className="text-gray-500 text-sm mb-4">
          {t('common.machines.profilePage.analytics.summary', { total: totalWOs, completed: totalCompleted })}
        </p>

        {totalWOs === 0 ? (
          <p className="text-gray-600 text-sm">{t('common.machines.profilePage.analytics.empty')}</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total" fill="#1A56DB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {byType.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('common.machines.profilePage.analytics.woType')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('common.machines.profilePage.analytics.total')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('common.machines.profilePage.analytics.completed')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('common.machines.profilePage.analytics.completionRate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byType.map((row) => (
                <tr key={row.type}>
                  <td className="px-4 py-3 text-gray-900 font-medium">{row.type}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.total}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-medium">{row.completed}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
