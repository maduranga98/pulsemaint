# Module 3: Asset & Machine Registry

This module provides comprehensive machine registration, tracking, and management for PulseMaint.

## Architecture

### File Structure
```
src/
├── types/machine.ts                  # Machine domain types
├── schemas/machine.ts                # Zod validation schemas
├── lib/
│   ├── machineHealth.ts             # Health score calculation
│   ├── machineQr.ts                 # QR code utilities
│   └── dateUtils.ts                 # Date formatting utilities
├── hooks/
│   ├── useMachines.ts              # Real-time machine list
│   ├── useMachine.ts               # Single machine real-time
│   ├── useMachineAnalytics.ts      # Machine analytics data
│   ├── useMachineCreate.ts         # Create machine with Firestore
│   └── useMachineUpdate.ts         # Update machine with Firestore
├── components/machines/
│   ├── MachineStatusBadge.tsx      # Status display (3 variants)
│   ├── MachineCriticalityBadge.tsx # Criticality display
│   ├── MachineHealthScore.tsx      # Health score visualization
│   ├── MachineFilterBar.tsx        # Search & filter controls
│   ├── MachineCard.tsx             # Mobile card view
│   ├── MachineListTable.tsx        # Desktop table view
│   ├── MachineFormStepper.tsx      # Multi-step form nav
│   └── index.ts                    # Component exports
└── pages/machines/
    ├── MachineListPage.tsx         # Registry view
    ├── AddMachinePage.tsx          # Create form (multi-step)
    ├── MachineProfilePage.tsx      # Detail view (tabbed)
    ├── EditMachinePage.tsx         # Edit form
    ├── MachineQrPage.tsx           # QR code view
    └── index.ts                    # Page exports
```

## Pages

### 1. Machine List Page (`/machines`)
- **Desktop**: Data table with sorting and pagination
- **Mobile**: Card-based layout (responsive stacking)
- **Features**:
  - Search by name, model, serial number, manufacturer
  - Filter by status, criticality, department, health score
  - Real-time list updates via Firestore listener
  - Responsive pagination (20 per page)
  - Action buttons: View, Edit, QR

### 2. Add Machine Page (`/machines/new`)
- **Desktop**: Vertical stepper + form sections
- **Mobile**: Horizontal progress bar + single section per screen
- **Sections**:
  1. Basic Information (name, type, manufacturer, model, serial)
  2. Location (department, floor, bay, station)
  3. Status & Criticality (status radio, 1-5 slider)
  4. Documents & Photos (drag-drop file upload)
  5. Spare Parts & Notes (text areas)
- **Features**:
  - Form validation with Zod
  - File upload to Firebase Storage
  - Auto-generation of QR code on save
  - Initial health score = 100

### 3. Machine Profile Page (`/machines/:id`)
- **Tabs**:
  1. **Overview**: Basic details, location, warranty, health metrics
  2. **Documents & Photos**: File gallery with download/preview
  3. **Breakdown History**: Timeline of past breakdowns
  4. **Maintenance History**: Work order timeline
  5. **Analytics**: Charts and KPIs (Manager/Admin only)
- **Header**: Machine name, status badge, health score gauge, action buttons
- **Health Score Banner**: Display + last service + next PM due

### 4. Edit Machine Page (`/machines/:id/edit`)
- Reuses form from Add Machine (pre-filled with current data)
- Status change to "Decommissioned" shows confirmation
- Shows "Last updated by X on Y" metadata

### 5. QR Code Page (`/machines/:id/qr`)
- Display machine QR code sticker for printing
- Actions:
  - Download as PNG
  - Download as PDF (Cloud Function - Phase 2)
  - Print (browser print dialog)
  - Regenerate (Admin only)
- Encodes URL: `https://app.pulsemaint.com/scan?machineId={id}&siteId={siteId}`

## Data Model

### Core Fields
- **Identity**: id, siteId
- **Basic Info**: name, model, serialNumber, manufacturer
- **Dates**: purchaseDate, installationDate, expectedLifespanYears
- **Location**: department, floor, bay, station
- **Status**: status (active/under_maintenance/decommissioned)
- **Health**: healthScore (0-100), criticality (1-5)
- **Service History**: lastServiceDate, lastTechnicians, partsReplaced
- **PM**: nextPmDue
- **Warranty**: warrantyItems[]
- **Documents**: documents[], photos[], sopLibraryRefs[]
- **QR**: qrCode (Storage URL)
- **Metadata**: createdAt, createdBy, updatedAt, updatedBy

### Health Score Algorithm
```
Start: 100 points
Deductions (last 90 days):
  - Critical breakdown: -20
  - High breakdown: -12
  - Medium breakdown: -6
  - Low breakdown: -3
  - Overdue PM: -10 each
  - Under Maintenance status: -5
Additions:
  - PM on time: +5 each (max +20)
Result: Clamped to 0-100
Color coding: Green (70+), Amber (40-69), Red (0-39)
```

## Permissions by Role

| Role | View | Edit | Delete | QR Gen | Decommission | Analytics |
|------|------|------|--------|--------|--------------|-----------|
| Technician | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Store Keeper | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Supervisor | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Plant Manager | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR Officer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Floor Operator | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Trainee | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## Hooks

### useMachines
- Real-time listener for machine list
- Supports filtering by status, criticality, health, department
- Pagination support (20 per page)
- Search filtering done on client

### useMachine
- Real-time listener for single machine
- Security: Verifies machine.siteId matches user.siteId

### useMachineAnalytics
- Calculates MTTR, MTBF, downtime, PM compliance
- Data from sub-collections (breakdownHistory, maintenanceHistory)

### useMachineCreate
- Handles Firestore document creation
- Uploads files to Firebase Storage
- TODO: QR code generation

### useMachineUpdate
- Updates machine document
- Handles file uploads
- Partial update support

## Utilities

### Health Score (`machineHealth.ts`)
- `calculateMachineHealthScore()` - Main algorithm
- `getHealthScoreColor()` - CSS color for score
- `getHealthScoreLabel()` - "Healthy"/"Warning"/"Critical"
- `formatMachineAge()` - Years/months since installation
- `getHealthScoreTrend()` - improving/stable/declining

### QR Code (`machineQr.ts`)
- `generateMachineQrUrl()` - Creates scan URL
- `getQRStickerLayout()` - Calculate sticker grid layout
- `calculateQRStickerSize()` - Size for layout (A4 sheet)
- `downloadQRCodeAsImage()` - Client-side PNG export
- `printQRCode()` - Browser print dialog

### Date Utils (`dateUtils.ts`)
- `formatDistanceToNow()` - "3 days ago"
- `formatDate()` - "Jan 15, 2024"
- `formatDateTime()` - Full timestamp
- `isOverdue()` - Check if date has passed
- `daysUntil()` - Days remaining to date

## Cloud Functions (Not Yet Implemented)

### generateMachineQrPdf
- Trigger: HTTPS callable
- Input: { machineId, siteId, layout: "1" | "4" | "9" }
- Output: Firebase Storage URL of PDF sticker sheet
- Uses Puppeteer for print-ready PDF generation

### recalculateMachineHealth
- Trigger: Firestore onWrite on machines/{id}/maintenanceHistory
- Action: Recalculate health score after breakdown/WO close
- Updates: machines/{id}.healthScore

### cleanOrphanedMachineFiles
- Trigger: Firestore onDelete on machines/{id}
- Action: Delete all Storage files for the machine
- Path: companies/{siteId}/machines/{machineId}/*

## Firestore Indexes

Required composite indexes:
- `machines: siteId + status`
- `machines: siteId + department`
- `machines: siteId + criticality`
- `machines: siteId + healthScore`
- `machines: siteId + nextPmDue`

## Firebase Storage Paths

```
companies/{siteId}/machines/{machineId}/
  ├── photos/{filename}        # Machine reference photos
  ├── documents/{filename}     # PDFs, CAD files, manuals
  └── qr/{machineId}_qr.pdf   # Generated QR code sticker
```

Max file sizes:
- Photos: 50MB each
- Documents: 100MB each
- Total per machine: 500MB

## Integration Points

### Module 1 (Breakdown Management)
- Machine data auto-fills breakdown form
- Health score recalculated after breakdown closed
- Breakdown history visible in Machine Profile

### Module 2 (Work Order Management)
- Machine dropdown in WO creation
- Location data auto-fills from machine
- WO close updates lastServiceDate, lastTechnicians, healthScore

### Module 6 (Inventory)
- Compatible parts linked to machines
- Machine profile shows linked parts with stock levels

### Module 8 (PM Scheduling)
- PM schedule reads nextPmDue
- PM completion updates nextPmDue

### Module 12 (Notifications)
- Machine status change triggers notifications
- Warranty expiry alerts
- Overdue PM reminders

## TODO / Phase 2+

- [ ] Cloud Functions for QR PDF generation
- [ ] Machine import/export (CSV)
- [ ] Machine type custom categories (Admin)
- [ ] Bulk machine operations
- [ ] Machine timeline events
- [ ] Advanced analytics charts (recharts)
- [ ] Machine comparison view
- [ ] Mobile app notifications for PM due
- [ ] IoT sensor integration
- [ ] OEE metrics calculation

## Testing Notes

- All forms use React Hook Form + Zod validation
- Real-time updates via Firestore onSnapshot
- Responsive design: mobile-first Tailwind
- No hardcoded colors - uses CSS variables
- Accessibility: proper labels, ARIA attributes, keyboard nav
