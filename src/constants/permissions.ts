import type { UserRole, BreakdownStatus } from '../types';

// ---------------------------------------------------------------------------
// Role → allowed status transitions
// ---------------------------------------------------------------------------

export const ALLOWED_TRANSITIONS: Record<UserRole, Partial<Record<BreakdownStatus, BreakdownStatus[]>>> = {
  maintenance_supervisor: {
    reported:           ['acknowledged'],
    acknowledged:       ['triage_in_progress', 'assigned'],
    triage_in_progress: ['assigned'],
    assigned:           ['acknowledged'],   // can re-assign → back to ack
    resolved:           ['closed'],
    on_hold_parts:      ['assigned'],
    on_hold_approval:   ['assigned'],
  },
  technician: {
    assigned:           ['en_route'],
    en_route:           ['repair_in_progress'],
    repair_in_progress: ['on_hold_parts', 'on_hold_approval', 'resolved'],
    on_hold_parts:      ['repair_in_progress'],
    on_hold_approval:   ['repair_in_progress'],
  },
  admin: {
    // admin can perform any transition — validated separately
  },
  plant_manager:  {},
  floor_operator: {},
  trainee:        {},
  store_keeper:   {},
  hr_officer:     {},
};

// ---------------------------------------------------------------------------
// Role → dashboard feature access flags
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<UserRole, {
  canCreateBreakdown: boolean;
  canAcknowledge: boolean;
  canAssign: boolean;
  canClose: boolean;
  canDragKanban: boolean;
  canViewAllBreakdowns: boolean;
  canExportHistory: boolean;
  canViewDashboard: boolean;
  canViewTechnicianTracker: boolean;
  canViewFactoryMap: boolean;
}> = {
  maintenance_supervisor: {
    canCreateBreakdown:       true,
    canAcknowledge:           true,
    canAssign:                true,
    canClose:                 true,
    canDragKanban:            true,
    canViewAllBreakdowns:     true,
    canExportHistory:         true,
    canViewDashboard:         true,
    canViewTechnicianTracker: true,
    canViewFactoryMap:        true,
  },
  technician: {
    canCreateBreakdown:       true,
    canAcknowledge:           false,
    canAssign:                false,
    canClose:                 false,
    canDragKanban:            false,
    canViewAllBreakdowns:     false,
    canExportHistory:         false,
    canViewDashboard:         false,
    canViewTechnicianTracker: false,
    canViewFactoryMap:        false,
  },
  plant_manager: {
    canCreateBreakdown:       false,
    canAcknowledge:           false,
    canAssign:                false,
    canClose:                 false,
    canDragKanban:            false,
    canViewAllBreakdowns:     true,
    canExportHistory:         true,
    canViewDashboard:         true,
    canViewTechnicianTracker: true,
    canViewFactoryMap:        true,
  },
  admin: {
    canCreateBreakdown:       true,
    canAcknowledge:           true,
    canAssign:                true,
    canClose:                 true,
    canDragKanban:            true,
    canViewAllBreakdowns:     true,
    canExportHistory:         true,
    canViewDashboard:         true,
    canViewTechnicianTracker: true,
    canViewFactoryMap:        true,
  },
  floor_operator: {
    canCreateBreakdown:       false,
    canAcknowledge:           false,
    canAssign:                false,
    canClose:                 false,
    canDragKanban:            false,
    canViewAllBreakdowns:     false,
    canExportHistory:         false,
    canViewDashboard:         false,
    canViewTechnicianTracker: false,
    canViewFactoryMap:        false,
  },
  trainee: {
    canCreateBreakdown:       false,
    canAcknowledge:           false,
    canAssign:                false,
    canClose:                 false,
    canDragKanban:            false,
    canViewAllBreakdowns:     false,
    canExportHistory:         false,
    canViewDashboard:         false,
    canViewTechnicianTracker: false,
    canViewFactoryMap:        false,
  },
  store_keeper: {
    canCreateBreakdown:       false,
    canAcknowledge:           false,
    canAssign:                false,
    canClose:                 false,
    canDragKanban:            false,
    canViewAllBreakdowns:     false,
    canExportHistory:         false,
    canViewDashboard:         false,
    canViewTechnicianTracker: false,
    canViewFactoryMap:        false,
  },
  hr_officer: {
    canCreateBreakdown:       false,
    canAcknowledge:           false,
    canAssign:                false,
    canClose:                 false,
    canDragKanban:            false,
    canViewAllBreakdowns:     false,
    canExportHistory:         false,
    canViewDashboard:         false,
    canViewTechnicianTracker: false,
    canViewFactoryMap:        false,
  },
};
