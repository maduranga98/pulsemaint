# FirmiCore — Machines module: knowledge file for video narration

Purpose of this file: it is the reference text for writing the spoken guide (narration) of the
Machines module videos. It describes only what the product really does. Use the exact on-screen
labels in **bold** when speaking, and do not invent features that are not listed here.

Narration style (apply to every scene):
- Calm, short sentences, one idea per sentence. About 130–150 words per minute in English.
- Say what the viewer does ("Click **+ Add Machine**"), then what happens ("The form opens").
- Keep button and field names in English even when speaking Sinhala (see the glossary at the end).
- Never read out passwords, real company names or real serial numbers shown in the demo data.
- Leave a short pause (1–2 seconds) after every click so the speech never runs ahead of the screen.

---

## 1. What the Machines module is

The Machines module is the register of every machine in the factory. Each machine has a profile
that holds its details, location, status, how critical it is, a health score, documents and
photos, spare parts, warranty, history of breakdowns and work orders, and a QR code that people
scan at the machine to report a breakdown.

Everything else in the system — breakdowns, work orders, preventive maintenance (PM) schedules,
inventory spare parts and analytics — is linked to a machine, so the register must be filled in
first.

Who can do what:

| Action | Who |
|---|---|
| View the machine list and a machine profile | Roles that have access to the module (for example supervisor, plant manager, admin, technician, trainee) |
| **+ Add Machine**, **Import** (bulk), **Edit**, **View QR Code** | Supervisor, Plant manager, Admin |
| Purchase price, expected scrap value, **Scrap machine**, the **Analytics** tab | Plant manager and Admin only |
| Report a breakdown by scanning the QR code | Anyone with a phone — no login is needed |

Plant and department rules: a person only sees the machines of their own plant, and a technician,
trainee, supervisor or floor operator is further limited to their own department. An admin sees
all plants and can pick a plant with the plant tabs at the top.

Plan limit: the number of machines a company can register depends on its plan (for example 15 on
the smallest plan, 75, 400, or unlimited on larger ones). When the limit is reached the system
refuses to add more and says so; bulk import checks the limit before it starts.

---

## 2. The machine list page

Open **Machines** in the left menu. The page shows every machine with its status, criticality
and health score.

What is on the page:
- A summary line with the number of machines.
- Search and **filters**: department, status, criticality and health score range.
  - Status values: **Active**, **Under Maintenance**, **Decommissioned**, **Scrapped**.
  - Criticality values: **5 – Mission Critical**, **4 – High**, **3 – Medium**, **2 – Low**, **1 – Minimal**.
  - Health score bands: **Good (70–100)**, **Warning (40–69)**, **Critical (0–39)**.
- A sort control (A–Z or Z–A).
- Buttons (for supervisor, plant manager, admin): **+ Add Machine**, **Import**, and **Export CSV**
  (exports the machines currently shown in the filtered list).
- Click a machine to open its profile.

Scrapped machines are shown at the bottom of the list, marked **Scrapped**; their history is kept.

---

## 3. Add one machine with the form (**+ Add Machine**)

Click **+ Add Machine**. A form with six steps opens. On a computer the steps are listed in a stepper on the
left: click a step name to go to it, and the **Create Machine** button is always at the bottom of the form.
On a phone the stepper is at the top and the **Back** and **Next** buttons move between steps.
If something required is missing when you submit, the form jumps to the step that has the problem and
shows a red message under the field.

An admin who is on "All Plants" must first choose the plant on the Location step (a company that
has no plants yet is not asked for a plant at all). Everyone else adds the machine to their own plant.

### Step 1 — Basic Information
- **Machine name** — required, up to 100 characters. Example: "CNC Lathe 01".
- **Machine type** — required. Choose from the list (CNC machine, conveyor, compressor, boiler,
  generator, hydraulic press, pump, motor, crane, lathe, milling machine, welding machine, HVAC,
  other). If none fits choose **Other — enter custom type** and type your own.
- **Manufacturer** — required. Example: "Mazak".
- **Model** — optional. **Serial number** — optional, but unique serial numbers make the machine easy to identify.
- **Purchase date**, **Installation date** — optional dates.
- **Expected lifespan (years)** — optional, a whole number from 1 to 100.
- **Purchase price** — only shown to plant manager and admin. The **Expected scrap value** is not typed in:
  it is worked out from the purchase price and expected lifespan (20% of the price for under 5 years,
  10% for 5–10 years, 5% beyond) and shown on the machine's Asset value card.

### Step 2 — Location
- **Plant** — only shown to an admin who has not picked a plant tab (and only if the company has plants).
- **Department** — required. Pick one from the list for that plant or type a new one.
- **Floor**, **Bay**, **Station** — optional (for example Ground, A1, 01). They tell a technician exactly where the machine is.
- This location also appears on the QR label and in breakdown reports.

### Step 3 — Status & Criticality
- **Status**: **Active** (running), **Under Maintenance**, or **Decommissioned**. New machines are normally **Active**.
- **Criticality** 1 to 5: how much production stops if this machine stops (5 = Mission Critical). It is
  used to prioritise breakdowns and work orders. Default is 3.
- **Health score** is shown read-only. Nobody types it: the system calculates it (see section 6).
- **Next PM due** (optional date) — when the next preventive maintenance is expected.

### Step 4 — Documents & Photos
- Add photos (JPG, PNG, WEBP, HEIC, up to 50 MB each) by clicking or dragging them in.
- Add documents such as a manual, schematic, warranty paper, certificate or SOP, and give each a type
  (manual, schematic, warranty, certificate, SOP, photo, other) and a name.
- Files are stored under the company's own folder; they appear later on the profile's **Documents** tab.

### Step 5 — Spare Parts
- Link the inventory parts that fit this machine (compatible / critical spare parts).
- Once linked, the machine profile shows these parts and a **low stock** warning when a linked part
  runs low, and the storekeeper is told.

### Step 6 — Notes & Warranty
- **Warranty information** — add one line per part: part name, warranty expiry date, supplier warranty reference.
- **Modification notes** — changes made to the machine (for example "Upgraded controller in 2024").
- **Additional notes** — anything else.
- Click **Create Machine**. The button shows "Saving...", then the machine is created.

Tips to say in the video:
- Fill the required fields first (name, type, manufacturer, department); everything else can be added later with **Edit**.
- Use the same department names everywhere so filters and reports group machines correctly.

---

## 4. Add many machines at once (**Import**)

Use this when you have a spreadsheet of machines.

1. On the machine list click **Import**. The window "Import Machines from CSV" opens.
2. Click **Download CSV Template**. A file named `machine_import_template.csv` is saved. Open it in Excel
   or Google Sheets. It already contains one example row — replace it with your machines.
3. Fill one machine per row. Keep the header row exactly as it is. Column names (all lower case):

   `name, type, manufacturer, model, serial_number, department, floor, bay, station, status, criticality, purchase_date, installation_date, next_pm_date, expected_lifespan_years, purchase_price, warranty_items, spare_parts, modification_notes, additional_notes`

4. Rules for the cells:
   - **Required in every row:** `name`, `type`, `manufacturer`. A row without them is marked with a red error and will not be imported.
   - `type`: any text is accepted (for example `cnc_machine`, `conveyor`, `compressor`, `boiler`,
     `generator`, `hydraulic_press`, `pump`, `motor`, `crane`, `lathe`, `milling_machine`,
     `welding_machine`, `hvac`, `other`); a custom type is allowed.
   - `status`: `active`, `under_maintenance` or `decommissioned` (blank means `active`).
   - `criticality`: a number 1–5 (1 = lowest, 5 = Mission Critical). Blank or invalid becomes 3.
   - Dates (`purchase_date`, `installation_date`, `next_pm_date`): write them as `YYYY-MM-DD`, for example `2026-09-01`.
   - `expected_lifespan_years`, `purchase_price`: plain numbers (commas are allowed, negative numbers are not).
     Scrap value must not be more than the purchase price. Prices are only saved when the importer is a plant manager or admin.
   - `warranty_items`: `Part Name:Expiry Date:Supplier Ref`, and separate several items with `;`
     (example: `Spindle Motor:2027-01-31:REF-123; Coolant Pump:2026-06-30`).
   - `spare_parts`: part names separated with `;`.
   - Put text with commas inside double quotes.
5. Back in the window click **Choose CSV File** and pick your CSV. A preview table appears showing every
   row; rows with problems are highlighted in red with the reason. The count of valid rows is shown.
6. An admin on "All Plants" must choose the **plant** the machines belong to (if the company has plants).
7. Click the blue button **Import N Machines** (N is the number of valid rows). A progress message
   "Importing... 3/12" shows while machines are created; when it finishes the message "Successfully
   imported N machines!" appears. Click **Close**. Rows with errors are skipped.

Safety checks done before importing: the file size and row count are limited, and the plan's machine
limit is checked against the machines you already have. Imported machines start with a health score of 100.

---

## 5. The machine profile (click a machine in the list)

### Header
Machine name, model and serial number, the department / floor / bay / station line, the **Status**
badge and the **Criticality** badge. A **Page tour** button starts a short guided tour of this page.
If the machine is scrapped, a pink banner shows the date, reason and amount, with **Undo** for managers.

### Spare parts panel
Lists the linked spare parts, low-stock ones first.

### Health banner
- A gauge shows the **Health score** (0–100).
- **Last service** date and type, and **Next PM due** (or "Not scheduled").
- Buttons (supervisor, plant manager, admin): **Edit Machine**, **View QR Code**, and **More**.
- **More** menu: **Create Work Order**, **Report Issue** (breakdown), **Export Details (PDF)**,
  **Scrap machine…** (plant manager / admin) and **Decommission Machine**.

### Tabs
- **Overview** — machine details (name, type, manufacturer, model, serial number, purchase and
  installation dates), location (department, floor, bay, station), status / criticality / health
  score, warranty items with their expiry, and (for managers) the asset card with purchase price,
  scrap value, depreciation and current value plus total maintenance spend.
- **Documents** — photos and documents with a **Download** link for each.
- **History** — the machine's breakdown history.
- **Maintenance** — work orders and maintenance records.
- **Analytics** — plant manager and admin only: work-order types (breakdown, corrective, preventive,
  installation, modification, inspection, contractor, other) and trends.

### Editing and status changes
- **Edit Machine** opens the same six-step form with the current values.
- **Decommission Machine** retires the machine from service but keeps its history.
- **Scrap machine…** records the date, reason (broken beyond repair, too old, not worth repairing,
  replaced by a new machine, other), details and any sale amount; the machine moves to the bottom of
  the list as **Scrapped**, its active PM schedules are archived, and **Undo** restores it.
- A machine shows **Under Maintenance** automatically while it has open repair work.

---

## 6. Health score — how to explain it

The health score is a number from 0 to 100. It is calculated by the system, never typed by a person,
and refreshed automatically when breakdowns, PM or work orders change, and every day.
- It starts at 100 and looks at the last 90 days.
- Deductions: a critical breakdown −20, high −12, medium −6, low −3; each overdue PM −10;
  −5 while the machine is under maintenance.
- Additions: each PM completed on time +5 (up to +20 in total).
- Bands: 70–100 Good, 40–69 Warning, 0–39 Critical.

---

## 7. QR code

Click **View QR Code** on the profile (supervisor, plant manager, admin). The **QR Code** page shows
a label with the company name, the machine name, its ID and location, and the text
"Scan to report breakdown".

Actions on the page:
- **Download QR (PNG)** — a picture to paste into a document.
- **Download QR (PDF)** — a print-ready page.
- **Print** — sends the label to the printer.
- **Regenerate QR** — shown as "Coming soon" (not available yet).
- A **QR Code Details** box shows the type (URL), size, format (QR code, error-correction level H, which still
  scans when slightly damaged) and the full address.

What the code contains: a web address of the FirmiCore app with the machine's id and site, for example
`https://<app address>/scan?machineId=…&siteId=…`. It never points to a developer machine.

What happens when someone scans it (say this in the video):
- **Nobody is signed in (the usual case on the factory floor):** the phone opens the public
  breakdown report form for that machine. The person describes the problem and submits — no account
  or login is needed. The report goes to the supervisors.
- **A signed-in user:** the app opens the in-app **Report breakdown** page with the machine already selected.
- Tip: print the label, laminate it, and stick it on the machine where it can be seen and scanned easily.

---

## 8. Suggested scene list for the videos

1. Open Machines and tour the list: filters, sort, buttons (30 s).
2. **+ Add Machine**: Basic Information (45 s).
3. Location and Status & Criticality (40 s).
4. Documents & Photos, Spare Parts, Notes & Warranty, **Create Machine** (50 s).
5. Bulk import: **Import**, **Download CSV Template**, fill the CSV, **Choose CSV File**, preview and errors, **Import N Machines** (75 s).
6. The machine profile: header, health banner, buttons (45 s).
7. Profile tabs: Overview, Documents, History, Maintenance, Analytics (50 s).
8. QR code: **View QR Code**, download / print, what scanning does (45 s).
9. Edit, Decommission and Scrap (30 s).

Timing note for the narrator: record or time each scene first, then write its speech so it fits the
scene length (about 2 words per second). Sinhala speech usually takes longer than English, so give
Sinhala scenes a little extra pause time or shorter sentences.

---

## 9. Glossary — keep these words in English while speaking Sinhala

Machine, Machines, **+ Add Machine**, **Import**, **Export CSV**, **Download CSV Template**, **Choose CSV File**, CSV, Plant, Department,
Floor, Bay, Station, Status, Active, Under Maintenance, Decommissioned, Scrapped, Criticality,
Health score, PM (preventive maintenance), Work Order, Breakdown, Spare parts, Warranty, Profile,
Overview, Documents, History, Maintenance, Analytics, QR code, Scan, Download, Print, Edit, Create Machine.

Suggested Sinhala for plain words (use these in sentences, keep the labels above in English):
machine = යන්ත්‍රය, factory = කර්මාන්තශාලාව, breakdown = බිඳවැටීම, spare part = අමතර කොටස,
report = වාර්තා කරන්න, click = ක්ලික් කරන්න, open = විවෘත කරන්න, save = සුරකින්න,
required = අනිවාර්යයි, optional = අත්‍යවශ්‍ය නොවේ, health = සෞඛ්‍යය, scan = ස්කෑන් කරන්න.
