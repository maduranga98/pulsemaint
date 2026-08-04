import type { WorkOrder } from '../../types/workOrder';
import { WOTypeBadge } from './WOTypeBadge';
import { WOStatusBadge } from './WOStatusBadge';
import { SLACountdownTimer } from './SLACountdownTimer';
import { WO_PRIORITY_CONFIG } from '../../constants/woConfig';

interface WOTableProps {
  workOrders: WorkOrder[];
  onSelect: (wo: WorkOrder) => void;
  showTypeColumn?: boolean;
}

export function WOTable({ workOrders, onSelect, showTypeColumn = true }: WOTableProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Work Order</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Machine</th>
              {showTypeColumn && (
                <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-gray-700">Priority</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">SLA</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Assigned</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
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
                    <div className="text-gray-900">{wo.machineName}</div>
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
                      {priorityConfig.label}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {workOrders.length === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm">No work orders found.</div>
      )}
    </div>
  );
}
