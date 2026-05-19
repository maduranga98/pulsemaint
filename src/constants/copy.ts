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
// Work Order copy
// ---------------------------------------------------------------------------

export const WO_COPY = {
  // List / header
  listTitle:              'Work Orders',
  createButton:           'Create Work Order',
  exportButton:           'Export to Excel',
  noOpenWOs:              'No open work orders. All caught up!',
  noWOsForFilters:        'No work orders match your filters.',
  loadingMessage:         'Loading work orders…',
  errorMessage:           'Failed to load work orders.',

  // Tabs
  tabAll:                 'All',
  tabMyWOs:               'My WOs',
  tabOpen:                'Open',
  tabOverdue:             'Overdue',
  tabThisWeek:            'This Week',

  // Create Drawer / Wizard
  createTitle:            'New Work Order',
  editTitle:              'Edit Work Order',
  step1Title:             'Basic Information',
  step2Title:             'Machine Selection',
  step3Title:             'Team Assignment',
  step4Title:             'Task Checklist',
  step5Title:             'Documents',
  step6Title:             'Parts Pre-Request',

  // Section 1
  woTypeLabel:            'Work Order Type',
  priorityLabel:          'Priority',
  descriptionLabel:       'Description',
  descriptionPlaceholder: 'Describe the work to be done in detail…',
  dueDateLabel:           'Due Date',
  dueDateHint:            'SLA deadline auto-suggested based on priority. You can adjust.',
  linkedBreakdownLabel:   'Linked Breakdown Ticket',
  linkedBreakdownPlaceholder: 'Search BD-YYYY-XXXX…',

  // Section 2
  machineLabel:           'Machine',
  machinePlaceholder:     'Search machine name, ID, or location…',
  machineHealthLabel:     'Health Score',
  machineOpenWOsLabel:    'Open WOs',
  machineLastServiceLabel: 'Last Service',

  // Section 3
  supervisorLabel:        'Supervisor In-Charge',
  supervisorPlaceholder:  'Search supervisor…',
  estimatedDurationLabel: 'Estimated Duration',
  scheduledStartLabel:    'Scheduled Start',
  techniciansLabel:       'Assign Technicians',
  techniciansPlaceholder: 'Select one or more technicians…',
  contractorCompanyLabel: 'Contractor Company',
  contractorPlaceholder:  'Search registered contractors…',
  contractorContactLabel: 'Contact Person',
  contractorPhoneLabel:   'Contact Number',
  contractorTechsLabel:   'On-site Technician Names',
  contractorTechsHint:    'One name per line',
  unregisteredContractorWarning: 'Register this contractor?',

  // Section 4
  checklistLabel:         'Task Checklist',
  addStepButton:          'Add Step',
  stepPlaceholder:        'Describe this step…',
  stepAssigneeLabel:      'Assign to',
  stepTimeLabel:          'Est. (min)',
  noChecklist:            'No steps added yet.',
  importTemplateButton:   'Import Template',

  // Section 5
  documentsLabel:         'Documents & References',
  uploadHint:             'Drag & drop or click to upload',
  storageUsed:            (used: string) => `${used} / 500 MB used`,
  cadFilesAccepted:       'CAD: DWG, DXF, STEP, STP, IGES, IGS, STL (100 MB max)',
  docsAccepted:           'Documents: PDF, DOCX, XLSX, PPTX, TXT (100 MB max)',
  imagesAccepted:         'Images: JPG, PNG, WEBP, HEIC (50 MB max)',
  videosAccepted:         'Videos: MP4, MOV, AVI (50 MB max)',

  // Section 6
  partsRequestLabel:      'Parts Pre-Request',
  partSearchPlaceholder:  'Search parts catalog…',
  quantityLabel:          'Quantity',
  unitLabel:              'Unit',
  noteLabel:              'Note (optional)',
  currentStockLabel:      'In Stock',
  addPartButton:          'Add to Request',
  noParts:                'No parts requested yet.',
  partsRequestSubmitted:  'Parts request submitted. Store Keeper notified.',

  // Detail panel tabs
  tabOverview:            'Overview',
  tabChecklist:           'Checklist',
  tabDocuments:           'Documents',
  tabParts:               'Parts',
  tabHistory:             'History',

  // Actions
  editButton:             'Edit',
  assignButton:           'Assign Team',
  cancelWOButton:         'Cancel WO',
  signOffButton:          'Sign Off',
  markEnRouteButton:      'Mark En Route',
  checkInButton:          'Check In (QR)',
  onHoldPartsButton:      'On Hold — Parts',
  onHoldApprovalButton:   'On Hold — Approval',
  completeButton:         'Open Completion Form',
  cancelReasonPlaceholder: 'Reason for cancellation…',

  // Completion form
  completionTitle:        'Work Order Completion',
  completionStep1:        'Work Details',
  completionStep2:        'Parts Used',
  completionStep3:        'Team Logs',
  completionStep4:        'Post-Repair Checklist',
  completionStep5:        'Test Run',
  completionStep6:        'Final Photos',
  completionStep7:        'Machine Status',
  actualStartLabel:       'Actual Start Time',
  actualEndLabel:         'Actual End Time',
  totalDurationLabel:     'Total Duration',
  workDoneLabel:          'Work Done Description',
  workDonePlaceholder:    'Describe all work performed in detail…',
  rootCauseLabel:         'Root Cause',
  rootCauseDescLabel:     'Root Cause Detail',
  rootCauseDescPlaceholder: 'Describe the root cause…',
  partsUsedLabel:         'Parts Used',
  addPartUsedButton:      'Add Part',
  sourceLabelStock:       'From Stock',
  sourceLabelExternal:    'External Purchase',
  unitCostLabel:          'Unit Cost (LKR)',
  totalCostLabel:         'Total Cost (LKR)',
  techLogsLabel:          'Technician Work Logs',
  hoursWorkedLabel:       'Hours Worked',
  tasksDescLabel:         'Tasks Performed',
  contractorHoursLabel:   'Contractor Hours',
  hoursOnSiteLabel:       'Hours On-Site',
  hoursBilledLabel:       'Hours Billed',
  postRepairChecklistLabel: 'Post-Repair Verification',
  allStepsMustPass:       'All steps must be completed before proceeding.',
  testRunLabel:           'Test Run Result',
  testRunNotesLabel:      'Test Run Notes',
  testRunNotesRequired:   'Required for Fail or Partial results.',
  finalPhotosLabel:       'Final Photos (min. 1 required)',
  addPhotoButton:         'Add Photo',
  machineStatusLabel:     'Machine Status After Repair',
  updatedCADLabel:        'Updated CAD Files',
  updatedCADHint:         'Required for Modification WOs.',
  warrantyDocsLabel:      'Warranty Documents',
  warrantyDocsHint:       'Required if new parts were installed with warranty.',
  submitCompletionButton: 'Submit Completion',
  completionSuccess:      'Completion submitted. Supervisor notified for sign-off.',

  // Sign-off
  signOffTitle:           'Supervisor Sign-Off',
  signOffInstructions:    'Review the completion summary and sign below to close this work order.',
  signaturePadLabel:      'Signature',
  clearSignatureButton:   'Clear',
  signOffNotesLabel:      'Sign-Off Notes (optional)',
  confirmSignOffButton:   'Confirm Sign-Off',
  signOffSuccess:         'Work order signed off and closed.',

  // SLA timer
  dueIn:                  (time: string) => `Due in ${time}`,
  overdueBy:              (time: string) => `Overdue by ${time}`,
  slaBreached:            'SLA Breached',

  // Stats
  openWOs:                'Open WOs',
  overdueWOs:             'Overdue',
  avgCompletionTime:      'Avg Completion',
  completedThisWeek:      'Completed This Week',

  // Kanban
  kanbanEmptyColumn:      'No work orders',
  kanbanDragHint:         'Drag to change status',

  // Machine history
  machineHistoryTitle:    'Maintenance History',
  noHistoryEntries:       'No maintenance history for this machine yet.',
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
