import type { ReportType } from '../../types/reports.types';
import type { UserRole } from '../../types/auth';

// Reports admin/plant_manager can see everything else in the hub; supervisor
// sees everything except this explicit exclusion list.
const SUPERVISOR_EXCLUDED_REPORTS: ReportType[] = [
  'technician_performance',
  'contractor_performance',
  'inventory_listing',
  'training_compliance',
  'low_stock_alert',
  'inventory_usage',
  'shift_handover_summary',
  'audit_trail',
  // PO History is admin/plant_manager/store_keeper only.
  'po_history',
];

// hr_officer and store_keeper only ever see this exact set — everything else
// in the hub is hidden for them, not just the reports above.
const HR_OFFICER_REPORTS: ReportType[] = [
  'technician_performance',
  'maintenance_cost',
  'contractor_performance',
  'training_compliance',
  'shift_handover_summary',
  'audit_trail',
];

const STORE_KEEPER_REPORTS: ReportType[] = [
  'inventory_usage',
  'low_stock_alert',
  'inventory_listing',
  'po_history',
];

// safety_officer sees safety and safety-adjacent compliance reports.
const SAFETY_OFFICER_REPORTS: ReportType[] = [
  'safety_incidents',
  'maintenance_cost',
  'shift_handover_summary',
  'audit_trail',
  'training_compliance',
];

/**
 * Filters a list of report types down to what a given role is allowed to see
 * in the Reports hub. Roles not covered here (technician, trainee, floor
 * operator, etc.) never reach this — the reports route itself is gated to
 * admin/plant_manager/supervisor/hr_officer/store_keeper only.
 */
export function filterReportTypesForRole(types: ReportType[], role: UserRole | undefined): ReportType[] {
  switch (role) {
    case 'admin':
    case 'plant_manager':
      return types;
    case 'supervisor':
      return types.filter((t) => !SUPERVISOR_EXCLUDED_REPORTS.includes(t));
    case 'hr_officer':
      return types.filter((t) => HR_OFFICER_REPORTS.includes(t));
    case 'store_keeper':
      return types.filter((t) => STORE_KEEPER_REPORTS.includes(t));
    case 'safety_officer':
      return types.filter((t) => SAFETY_OFFICER_REPORTS.includes(t));
    default:
      return [];
  }
}
