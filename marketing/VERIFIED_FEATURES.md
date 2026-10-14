# FirmiCore: verified features for marketing prompts

Source: read directly from the code (routes, pages, i18n text in `src/locales/en-US.json`, types) and the in-app help text (`help.modules`). Use ONLY these when writing posts, captions or video prompts. If a claim is not here, check the code first.

## QR codes (three different things)
- **Machine QR** (`/scan` -> `/report-breakdown`): ONLY for reporting a breakdown. Not signed in: public no-login page titled "Report a breakdown - no sign-in required", machine name shown ("Reporting on"), field "What happened?" (mic dictation available), checkbox "Machine is still running (degraded but operational)", submit, then "Breakdown reported - Ticket XXX has been sent to the maintenance team." Signed in: opens the in-app Report Breakdown form with the machine pre-filled.
- **Part QR** (inventory): scanned on Inventory > Manual Issue ("Scan part QR") to issue parts. A part's QR is shown from the part detail page.
- **Contractor Safety Card QR**: scanning (in-app "Scan safety card" on Safety Cases, or `/safety-card`) opens a safety-case report for the card holder.
- A machine QR NEVER opens machine history, health score, documents or warranty.

## Breakdowns and work orders
- Breakdowns: report, queue with ticket number, attend (diagnose, record fix), close, or convert to a work order.
- Work order types: Breakdown, Corrective, Preventive, Installation, Modification, Inspection, Contractor, Other. Priority: critical/high/medium/low. Checklist, parts used, photos, optional Work Permit. Lifecycle: Draft > Open > Assigned > In Progress > On Hold > Completed > Signed Off > Closed. Supervisor or above signs off.

## Machines
- Machine Profile tabs: Overview, Documents & Photos, Breakdown History, Maintenance History, Analytics. Shows Status, Criticality, Health Score, Next PM Due, Last Service, Warranty (expires date), photos, documents.
- Header: Edit Machine, View QR Code, More: Create Work Order, Report Issue, Export Details (PDF), Decommission Machine.
- Health score 0-100: starts at 100, deducted for breakdowns by severity and overdue PM (trailing 90 days), credited for on-time PM.
- NOT FOUND in code: an automatic "repeat failure" alert; a routed standalone "Maintenance History" page for plant managers (FEATURES.md and locale text describe `/app/maintenance-history` with Export PDF, but there is no route or page for it in this codebase). Confirm on the live site before showing it.

## Preventive maintenance (PM)
- Recurrence: daily, weekly, biweekly, monthly, quarterly, semi-annual, annual, custom. Meter triggers: operating hours or production cycles.
- Checklist items (checkbox or measurement with min/max, photo required), pre-allocated parts, default technician. PM Calendar (day/week/month), PM Workload, compliance history (on time, late, overdue, missed).

## Triage (live page `/app/triage`)
- Knowledge-style page: left Categories rail; content items (procedures with steps, guides, video, PDF, image); "Responsible Persons" (emergency and normal contacts); "Quick Assessments" (quizzes with a pass mark). Builder for authorised roles.
- NOT the live page: the yes/no branching "flow runner" with auto-escalation to a work order (legacy pages, still routed under `/app/triage/:sessionId`).
- Language: the whole app UI ships in 12 languages (ar, bn, de, en, es, fr, hi, ja, si, ta, ur, zh). Do not claim triage content is multilingual.

## Safety
- **Safety Cases**: any company member can report. Types: Incident, Near-Miss, Hazard, Unsafe Act. Severity Low/Medium/High/Critical; "Safety points (auto from severity)" = 1/3/6/10. Fields: title, location, what happened, action that should be taken, optional "Report to" a manager, subject (work order, operator, technician, contractor, other), photo. Status open > investigating > closed; "Record an action" notes; closed cases lock.
- **Work Permits** (Permit-to-Work): category Hot Work, Confined Space, Electrical Isolation, Working at Height, Excavation, Chemical Handling, General (plus company-added categories), each with preset precaution checklist; hazards, PPE required, validity window, optional linked work order and supervisor. Tabs Current/Closed; "Extend time"; "Finish & sign off" with completion status (Completed / Partially Completed / Not Completed); "Overdue" flag.
- **Blacklist**: technicians, contractors, operators or machines over the safety-case point threshold are blocked from new work-order/job assignment until an admin clears them.
- **Safety Trainings**: schedule sessions (company staff).
- **Contractor safety training**: contractor team members (no logins) get an emailed link to a public "Safety training" page: shows name, company, site, complete-before date, attempts ("x of 3 used"); optional quiz with pass mark; comments; optional photos (max 5) and voice notes (max 2); declaration tick; typed full-name signature; submit ("Thank you - your safety officer will review your submission"). Only the final submission is kept.
- Safety officer panel: Awaiting review / Signed off / Active safety cards. Sign off = tick verified qualifications (from the team member's profile) + drawn signature. Then Issue safety card: Contractor Safety Card, 3.5 x 2 in, front and back, QR code, valid 12 months by default; can be revoked (reason required).

## Contractors
- Registry: cards with status Active / Inactive / Blacklisted and a document status dot (valid / expiring soon / expired). Alert banners: documents expiring within 30 days; "Job assignment blocked - [document] expired. Renew to assign jobs."
- Profile tabs: Overview, Documents, Team Members, Job History, Analytics. Team members are for gate identification and job history.
- Add Contractor steps: Company, Contacts, Specializations, Financial (plant managers and admins only), Documents.
- Document Compliance page: Total contractors, Fully valid, Expiring docs, Blocked.
- Jobs: stepper Invited > Acknowledged > On Site > Working > Checklist > Signed Off > Invoice > Done. Arrival and departure log, job timeline (waiting for parts / permission), work log steps with photos, parts used (factory parts issued vs contractor materials), post-job checklist (pass/fail), SLA deadline, Sign-Off, Invoice comparison, Rate contractor.
- Reports: performance, invoice comparison, job history, rating, document compliance (PDF, Excel, Google Sheets).

## Multi-plant
- Settings > Plants (admin): plant name, code, address, contact person, active/inactive. Users, machines, contractors and inventory are registered under a plant.
- Plant tabs ("All Plants" + each plant) at the top of the app are shown to **admin only**. Every other role (including plant manager) is locked to their own plant.
- Plan-gated: confirm your plans include multi-site before promoting.

## Shift handover
- Create Shift Handover: "Review the compiled shift summary and transfer accountability to the incoming supervisor." Shift summary snapshot (per docs: pending work orders, ongoing breakdowns, low-stock alerts, watch flags). History and detail views; briefing for incoming shift.

## Other verified
- Inventory: catalog with auto part numbers, reorder point flags, suppliers, purchase orders (ordered/partially received/received), parts requests fulfilled by the storekeeper, receiving, movement log, Excel import.
- Reports hub with PDF/Excel export and Google Sheets push; Analytics tabs; MOE (machine operating efficiency).
- Training: module libraries, assignments, quizzes, certificates (PDF), trainee programmes.
