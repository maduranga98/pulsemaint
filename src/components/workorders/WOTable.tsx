import { useTranslation } from 'react-i18next';
import type { WorkOrder } from '../../types/workOrder';
import { WOTypeBadge } from './WOTypeBadge';
import { WOStatusBadge } from './WOStatusBadge';
import { SLACountdownTimer } from './SLACountdownTimer';
import { WO_PRIORITY_CONFIG } from '../../constants/woConfig';

interface WOTableProps {
  workOrders: WorkOrder[];
  onSelect: (wo: WorkOrder) => void;
  showTypeColumn?: boolean;
  // Sign Off is only offered once a WO is COMPLETED and awaiting closure, and
  // only to callers who pass a handler — gating (supervisor/plant manager/
  // admin) is the caller's responsibility, same as elsewhere in the WO module.
  canSignOff?: boolean;
  onSignOff?: (wo: WorkOrder) => void;
}

const PRIORITY_LABEL_KEYS: Record<string, string> = {
  critical: 'common.workorders.priorityBadge.critical',
  high: 'common.workorders.priorityBadge.high',
  medium: 'common.workorders.priorityBadge.medium',
  low: 'common.workorders.priorityBadge.low',
};

export function WOTable({ workOrders, onSelect, showTypeColumn = true, canSignOff = false, onSignOff }: WOTableProps) {
  const { t } = useTranslation();
  const showActionColumn = canSignOff && !!onSignOff;
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colWorkOrder')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colMachine')}</th>
              {showTypeColumn && (
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colType')}</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colPriority')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colSLA')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colAssigned')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colStatus')}</th>
              {showActionColumn && (
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.workorders.table.colAction')}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {workOrders.map((wo) => {
              const priorityConfig = WO_PRIORITY_CONFIG[wo.priority];
              return (
                <tr
                  key={wo.id}
                  onClick={() => onSelect(wo)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{wo.woNumber || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(wo);
                      }}
                      className="text-left text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {wo.machineName}
                    </button>
                    <div className="text-gray-400 text-xs">{wo.machineLocation}</div>
                  </td>
                  {showTypeColumn && (
                    <td className="px-4 py-3">
                      <WOTypeBadge woType={wo.woType} size="sm" />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityConfig.bgClass} ${priorityConfig.textClass}`}
                    >
                      {t(PRIORITY_LABEL_KEYS[wo.priority])}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SLACountdownTimer slaDeadline={wo.slaDeadline} status={wo.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {wo.assignedTechnicianNames.join(', ') || ''}
                  </td>
                  <td className="px-4 py-3">
                    <WOStatusBadge status={wo.status} size="sm" />
                  </td>
                  {showActionColumn && (
                    <td className="px-4 py-3">
                      {wo.status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSignOff?.(wo);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
                        >
                          {t('common.workorders.table.signOff')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {workOrders.length === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm">{t('common.workorders.table.empty')}</div>
      )}
    </div>
  );
}
