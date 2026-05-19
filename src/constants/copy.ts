// PulseMaint — UI copy constants
// All user-facing strings live here. No hardcoded strings in components.

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const APP = {
  name: 'PulseMaint',
  tagline: 'Keep the pulse of your plant.',
  company: 'Lumora Ventures Pvt Ltd',
} as const;

// ---------------------------------------------------------------------------
// Navigation labels
// ---------------------------------------------------------------------------

export const NAV = {
  dashboard: 'Dashboard',
  breakdowns: 'Breakdowns',
  workOrders: 'Work Orders',
  machines: 'Machines',
  menu: 'Menu',
  history: 'History',
  settings: 'Settings',
  notifications: 'Notifications',
  technicians: 'Technicians',
  reports: 'Reports',
} as const;

// ---------------------------------------------------------------------------
// Breakdown status labels
// ---------------------------------------------------------------------------

export const BREAKDOWN_STATUS_LABELS: Record<string, string> = {
  reported:           'Reported',
  acknowledged:       'Acknowledged',
  triage_in_progress: 'Triage In Progress',
  assigned:           'Assigned',
  en_route:           'En Route',
  repair_in_progress: 'Repair In Progress',
  on_hold_parts:      'On Hold — Parts',
  on_hold_approval:   'On Hold — Approval',
  resolved:           'Resolved',
  closed:             'Closed',
};

// ---------------------------------------------------------------------------
// Breakdown severity labels
// ---------------------------------------------------------------------------

export const BREAKDOWN_SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
};

// ---------------------------------------------------------------------------
// Breakdown type labels
// ---------------------------------------------------------------------------

export const BREAKDOWN_TYPE_LABELS: Record<string, string> = {
  mechanical:  'Mechanical',
  electrical:  'Electrical',
  hydraulic:   'Hydraulic',
  pneumatic:   'Pneumatic',
  software:    'Software',
  other:       'Other',
};

// ---------------------------------------------------------------------------
// Root cause labels
// ---------------------------------------------------------------------------

export const ROOT_CAUSE_LABELS: Record<string, string> = {
  wear_and_tear:          'Wear & Tear',
  operator_error:         'Operator Error',
  manufacturing_defect:   'Manufacturing Defect',
  lack_of_maintenance:    'Lack of Maintenance',
  external_damage:        'External Damage',
  unknown:                'Unknown',
};

// ---------------------------------------------------------------------------
// Source labels
// ---------------------------------------------------------------------------

export const BREAKDOWN_SOURCE_LABELS: Record<string, string> = {
  qr_scan:       'QR Scan',
  whatsapp:      'WhatsApp',
  web_browser:   'Web Browser',
  technician_qr: 'Technician QR',
  iot:           'IoT Sensor',
};

// ---------------------------------------------------------------------------
// Role labels
// ---------------------------------------------------------------------------

export const USER_ROLE_LABELS: Record<string, string> = {
  floor_operator:         'Floor Operator',
  trainee:                'Trainee',
  technician:             'Technician',
  store_keeper:           'Store Keeper',
  maintenance_supervisor: 'Maintenance Supervisor',
  plant_manager:          'Plant Manager',
  hr_officer:             'HR Officer',
  admin:                  'Admin',
};

// ---------------------------------------------------------------------------
// Create Breakdown form
// ---------------------------------------------------------------------------

export const CREATE_BREAKDOWN = {
  title:                    'Report Breakdown',
  step1Title:               'Machine & Severity',
  step2Title:               'Description & Photos',
  step3Title:               'Production Impact',
  machineLabel:             'Machine',
  machinePlaceholder:       'Search machine name or ID…',
  severityLabel:            'Severity',
  typeLabel:                'Breakdown Type',
  descriptionLabel:         'Description',
  descriptionPlaceholder:   'Describe the fault in detail…',
  photosLabel:              'Photos',
  photosHint:               'Up to 5 photos · JPG, PNG, WEBP, HEIC · Max 50 MB each',
  videoLabel:               'Video (optional)',
  videoHint:                'MP4, MOV, AVI · Max 50 MB',
  machineRunningLabel:      'Machine Still Running?',
  productionImpactLabel:    'Production Impact',
  productionImpactPlaceholder: 'Describe the impact on production output…',
  attemptedFixesLabel:      'Attempted Fixes',
  attemptedFixesPlaceholder: 'What was tried before reporting?',
  submitButton:             'Submit Breakdown',
  submittingButton:         'Submitting…',
  cancelButton:             'Cancel',
  nextButton:               'Next',
  backButton:               'Back',
  uploadPhotos:             'Upload Photos',
  takePhoto:                'Take Photo',
  dragDropHint:             'Drag & drop or click to upload',
  successMessage:           'Breakdown reported successfully.',
  errorMessage:             'Failed to submit breakdown. Please try again.',
} as const;

// ---------------------------------------------------------------------------
// Root cause form
// ---------------------------------------------------------------------------

export const ROOT_CAUSE_FORM = {
  title:                        'Root Cause Analysis',
  subtitle:                     'Complete before marking as Resolved.',
  rootCauseLabel:               'Root Cause',
  rootCauseDescriptionLabel:    'Root Cause Detail',
  rootCauseDescriptionPlaceholder: 'Describe the root cause in detail…',
  correctiveActionsLabel:       'Corrective Actions Taken',
  correctiveActionsPlaceholder: 'What was done to fix the issue?',
  preventiveRecommendationsLabel: 'Preventive Recommendations',
  preventiveRecommendationsPlaceholder: 'What should be done to prevent recurrence?',
  resolutionPhotosLabel:        'Resolution Photos',
  submitButton:                 'Mark as Resolved',
} as const;

// ---------------------------------------------------------------------------
// Kanban board
// ---------------------------------------------------------------------------

export const KANBAN = {
  emptyColumnHint:  'No breakdowns',
  dragHint:         'Drag to change status',
  loadingMessage:   'Loading breakdowns…',
  errorMessage:     'Failed to load breakdowns.',
  emptyState:       'No active breakdowns. Great job! 🎉',
} as const;

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

export const STATS_BAR = {
  totalActive:         'Total Active',
  critical:            'Critical',
  high:                'High',
  medium:              'Medium',
  productionHoursLost: 'Prod. Hours Lost',
  mttrToday:           'Avg MTTR Today',
  resolvedToday:       'Resolved Today',
  overdue:             'Overdue',
} as const;

// ---------------------------------------------------------------------------
// QR Scanner
// ---------------------------------------------------------------------------

export const QR_SCANNER = {
  title:           'Scan Machine QR Code',
  instruction:     'Point the camera at the machine QR sticker',
  scanningMessage: 'Scanning…',
  errorCamera:     'Camera access denied. Please allow camera permissions.',
  errorNotFound:   'QR code not recognised. Try again.',
  successMessage:  'Machine identified!',
  cancelButton:    'Cancel',
} as const;

// ---------------------------------------------------------------------------
// Notifications / alerts
// ---------------------------------------------------------------------------

export const ALERTS = {
  slaBreachWarning:     (minutes: number) => `SLA breach in ${minutes} min`,
  slaBreached:          'SLA Breached',
  recurringBreakdown:   (machineName: string, type: string, count: number) =>
    `⚠️ ${machineName} has had ${count}+ ${type} breakdowns in 30 days`,
  escalationSent:       'Escalation sent to Plant Manager.',
  unacknowledged10min:  'Breakdown unacknowledged for 10 minutes.',
} as const;

// ---------------------------------------------------------------------------
// History table
// ---------------------------------------------------------------------------

export const HISTORY_TABLE = {
  title:             'Breakdown History',
  exportButton:      'Export to Excel',
  filterButton:      'Filter',
  clearFilters:      'Clear Filters',
  noResults:         'No breakdowns match your filters.',
  expandRow:         'View details',
  columns: {
    ticketNumber:    'Ticket',
    machine:         'Machine',
    severity:        'Severity',
    type:            'Type',
    status:          'Status',
    reporter:        'Reported By',
    reportedAt:      'Reported At',
    resolvedAt:      'Resolved At',
    mttr:            'MTTR',
    technician:      'Technician',
    recurring:       'Recurring',
  },
} as const;

// ---------------------------------------------------------------------------
// General UI
// ---------------------------------------------------------------------------

export const UI = {
  loading:       'Loading…',
  error:         'Something went wrong.',
  retry:         'Retry',
  save:          'Save',
  cancel:        'Cancel',
  confirm:       'Confirm',
  delete:        'Delete',
  edit:          'Edit',
  close:         'Close',
  back:          'Back',
  viewDetails:   'View Details',
  assign:        'Assign',
  acknowledge:   'Acknowledge',
  noData:        'No data available.',
  yes:           'Yes',
  no:            'No',
  search:        'Search…',
  all:           'All',
  today:         'Today',
  thisWeek:      'This Week',
  thisMonth:     'This Month',
} as const;
