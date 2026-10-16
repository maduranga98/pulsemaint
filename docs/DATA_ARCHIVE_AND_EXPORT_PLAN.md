# Data archive & export plan (proposal — not implemented)

Goal: **no storage quota for customers**, but bounded storage cost. Files stay online for a plan-based window; older files are exported as a ZIP that can be opened years later without FirmiCore, delivered to the company admin, and then removed from online storage.

Facts below come from `storage.rules`, `docs/STORAGE_AND_DATA_LIFECYCLE.si.md`, `functions/src/platform/deleteCompany.js`, `functions/src/reports/cleanupOldReports.js` and the upload hooks. Cloud Storage prices (US multi-region, per GB-month): Standard $0.026, Nearline $0.015, Coldline $0.007, Archive $0.0024 (seen in Google's pricing page via search); retrieval fees and minimum storage durations are not verified.

## 1. How data is stored today

- **Firestore** (`default` database, nam5): records (work orders, breakdowns, audits, …). Records carry file references, but not in one uniform shape: work orders store `{url, storagePath}` per document (the completion flow stores the download URL inside `storagePath`), and `finalPhotoUrls` is a bare `string[]` of download URLs. The object path must therefore be derived from the URL (`/o/<url-encoded path>?alt=media&token=…`).
- **Cloud Storage** roots (see `storage.rules`): `workorders/{siteId}/{woId}/…` (documents, field-media, completion photos/CAD/warranty, approval-requests), `breakdowns/{siteId}/{ticketId}/media/…`, `audit_attachments`, `audit_reports`, `audits`, `kaizen` (keyed by plant), `evaluation_attachments/{companyId}`, `companies/{c}/{staff_requests, purchaseOrders, training, trainee-programmes, machines, contractors, inventoryParts, branding, content}`, `safetyTrainingSubmissions/{company}`, `triage/…`, generated `reports/{company}`.
- **Rules:** evidence paths are create-only for clients — nothing deletes them except Cloud Functions (Admin SDK). Reports are the only thing auto-deleted (30 days, `cleanupOldReports`).
- **Consequence:** old links are download-token URLs. Deleting an object kills them, so every screen showing a file needs an "archived" state. Moving an object to a colder storage class does **not** change its URL.
- No per-company usage counter, no compression of work-order/breakdown photos, no archive of any kind exists today.

## 2. Options

| Option | What | Saves | Cost to build | Risk |
|---|---|---|---|---|
| A. Lifecycle rule | Bucket rule: move objects older than 12 months to Nearline (later Coldline) | ≈ 40% of the storage cost of aged files (≈ 20–30% overall) | ½ day, no code | Retrieval fees on old views; same rule for every company |
| B. Export + remove (requested) | ZIP archive per company/quarter, handover to admin, remove online copies | ≈ 90–99% of old-file cost | 3–4 weeks | Broken links if UI not updated; irreversible deletion needs contract + safeguards |
| C. Both (recommended) | A now; B behind it, with plan-based windows | Both | A then B | — |

## 3. Policy

- **Online window** (counted from the record's close date): **12 months for plant managers and admins on every plan; 30 days for supervisors and other roles** (see `DATA_RETENTION_AND_VISIBILITY_PLAN.md`). Longer online history is an add-on ($5 / $15 / $60 per month for Starter / Growth / Factory); Enterprise per contract.
- **Exported, then removed online (always with all their attachments):** closed work orders and breakdowns, completed audits, closed Kaizen, closed staff requests (replies included), paid PO invoices.
- **Retired master data** (decommissioned machines, inactive contractors, discontinued parts): exported with their photos, manuals, certificates and warranty files 24 months after retirement, then removed.
- **Copied, never removed:** safety training submissions and certificates, training certificates, offboard reports — compliance copies are included in the ZIP.
- **On demand:** the admin can request a full-company export (every record + every attachment) at any time; it also runs automatically when a company is closed.
- **Never touched:** live files of active machines and contractors, the training content library, the logo. A per-company **legal hold** flag stops archiving and removal.
- **Records stay in Firestore** (searchable, with an `archive: {archiveId, archivedAt}` marker); only the files leave.
- **Removal rule:** online copies are removed after the admin confirms the download, or 60 days after the first notice (stated in the terms). The ZIP itself stays 12 months in Archive-class storage for re-download, then is deleted with a final notice. Nothing is removed unless the ZIP's checksums were verified.
- **Retention guidance** (docs/STORAGE_AND_DATA_LIFECYCLE.si.md §5): work orders and breakdowns 5+ years, safety 5–7 years — after handover the customer holds the legal copy; say so in the terms.
- **Company closure / churn:** `platformDeleteCompany` currently erases everything. Add a final export first; expired trials and cancelled accounts: read-only 90 days, then purge.

## 4. Archive package

```
FirmiCore-Archive-<company>-<period>-part1of3.zip      (≤ 2 GB per part, ZIP64)
 ├─ index.html          offline viewer: search by date / machine / number, no login, no server
 ├─ viewer/             bundled JS & CSS (no CDN)
 ├─ records/<number>/   record.pdf (same content as the Maintenance History export), record.json, attachments/<original files>
 ├─ conversation/       staff-request replies and their attachments
 ├─ master/             retired machines, contractors, parts with their documents
 ├─ compliance/         copies of safety training submissions and training certificates
 ├─ data/               records.csv, records.json
 ├─ manifest.json       archive id, company, period, counts, SHA-256 of every file, format version
 └─ README.txt          how to open and verify
```
Standard formats only (PDF, JPEG, PNG, MP4, CSV, JSON, HTML).
`record.pdf` should reuse the existing renderer (`src/utils/reports/pdf/maintenanceRecordPdf.ts`, jsPDF in the browser today); the server side needs either a port or the existing puppeteer setup used by `generateReport`.

## 4a. Attachment inventory — every record exports with its files

| Record | Files live under | How the record points to them | In the ZIP | After export |
|---|---|---|---|---|
| Work order | `workorders/{siteId}/{woId}/documents`, `field-media`, `completion/{photos,cad,warranty}`, `approval-requests` | `documents[]` `{url, storagePath}`; completion `finalPhotoUrls[]` (URLs only); approval `attachments[]` | `records/<WO>/attachments/…` | removed |
| Breakdown | `breakdowns/{siteId}/{ticketId}/media` | media URLs on the ticket (field name to confirm in code) | `records/<TICKET>/attachments/…` | removed |
| Audit | `audit_attachments/{plantId}/{session}/…`, `audits/{plantId}/{audit}/{item}.jpg`, `audit_reports/{plantId}/{id}.pdf` | URLs on session / item docs | `records/<AUDIT>/attachments/…` + report PDF | removed |
| Kaizen card | `kaizen/{plantId}/{card}/…` | URLs on the card | `records/<CARD>/attachments/…` | removed |
| Evaluation | `evaluation_attachments/{companyId}/{evaluation}/…` | URLs on the evaluation | `records/<EVAL>/attachments/…` | removed |
| Staff request + replies | `companies/{c}/staff_requests/{request}/…` | `attachments[]` on the request and on each reply | `records/<REQ>/attachments/` and `conversation/` | removed |
| Purchase order | `companies/{c}/purchaseOrders/{po}/invoice` | invoice URL on the PO | `records/<PO>/attachments/…` | removed |
| Retired machine | `companies/{c}/machines/{id}/photos`, `documents` | URLs on the machine | `master/machines/<id>/…` | removed 24 months after retirement |
| Inactive contractor | `companies/{c}/contractors/{id}/documents`, `…/technicians/certifications` | URLs on contractor / technician docs | `master/contractors/<id>/…` | removed 24 months after inactive |
| Discontinued part | `companies/{c}/inventoryParts/{id}/warranty` | URLs on the part | `master/parts/<id>/…` | removed 24 months after discontinuation |
| Safety training submission | `safetyTrainingSubmissions/{c}/{invite}/attempt-N` | written by the callable, linked from the invite | `compliance/safety-training/…` | **copy only** |
| Training certificates, offboard reports, weekend summaries | `companies/{c}/trainee-programmes/…`, `training/offboard-reports/…` | URLs on the certificate / report docs | `compliance/training/…` | **copy only** |

Rules for the archiver:
- Resolve each file from `storagePath` or, when only a URL exists, by decoding the object path from the download URL; then also **list the record's folder** so files with no reference are not lost (they go under `unreferenced/`).
- Every attachment gets an entry in `record.json`: original name, object path, size, content type, uploader, upload date, SHA-256, ZIP entry. Files that cannot be found are listed under `missing` — never silently skipped.
- Name collisions inside a record folder get a numeric suffix; the original name is kept in the manifest.
- Large files are streamed (never fully in memory); parts split at ≤ 2 GB with a file never split across parts.
- Safety cases and permits: no stored files were found in `src/types/safety.ts` — confirm before shipping. Contractor safety-form photos and voice notes are encoded in the browser but are stored as files by the server (`safetyTrainingSubmissions/…`), so they are covered by the compliance copy.
- `records/<number>/record.pdf` embeds the images; for archived records the in-app PDF export must fall back to the ZIP's copy.

## 5. Pipeline (Cloud Functions + Cloud Tasks)

1. `scheduleArchiveRuns` (monthly, per company): select records closed before `now − window`, not yet archived, not on legal hold; group by quarter; create `companies/{id}/archives/{archiveId}` (status `planned`, estimate of bytes/files).
2. `buildArchive` (one Cloud Task per part): resolve object paths from URLs/`storagePath`, stream objects into a ZIP written directly to `archives/{companyId}/{archiveId}/part-N.zip` (cold storage class), compute SHA-256, re-read and verify, set `ready`. Parts keep each task inside the function timeout; very large companies may need a Cloud Run Job (timeouts to be confirmed).
3. `notifyArchiveReady`: email to company admins (existing mailer) and an in-app page **Settings → Data archives** (admin only): list, size, period, short-lived signed download links (regenerated on request), checksum, "I have downloaded and verified" button.
4. Reminders at 14 and 30 days; superadmin console shows per-company archive status.
5. `purgeArchived`: after confirmation or 60 days, delete the original objects (Admin SDK bypasses create-only rules), batch-update Firestore markers, write `archiveAuditLog` (who confirmed, when, bytes freed).
6. Every file-showing component renders an "Archived in <archive> — download from Settings" tile when the record has the marker; PDF export must skip archived images gracefully.

Optional later: deliver the ZIP to the customer's Google Drive (OAuth for Sheets already exists); keep 320 px thumbnails online so lists still show previews; re-import for restore.

## 5a. Viewing an archive (offline viewer)

- **How a customer opens it:** extract the ZIP (not preview it inside the ZIP), open `index.html` in any browser. No login, no internet, no FirmiCore. Windows "Open" inside the ZIP does not work because the viewer needs its sibling files — the README says "Extract all first".
- **Viewer technology:** plain HTML + JavaScript bundled in the ZIP. Data is shipped as sharded `data/*.js` files (not `fetch()` of JSON — browsers block that on `file://`), with a small built-in search index. Attachments are normal relative links: images open in a gallery, videos and PDFs open in the browser, other files download.
- **Tabs and what each shows:**
  - *Work orders* — list (number, machine, type, dates, status, cost) with search and filters; detail page with checklist, work logs, parts and labour, root cause, sign-off and a gallery of all attachments (field media, completion photos, CAD/warranty files as links).
  - *Breakdowns* — same pattern: severity, downtime, root cause, media.
  - *Work permits* — category, validity, precautions, issuer, closure, attachments.
  - *Inventory* — parts snapshot at archive time and stock movements for the archived period (CSV + searchable table), linked to the work orders that consumed them; purchase orders with invoice files.
  - *Audits / Kaizen / evaluations / staff requests (with replies)* — each its own tab.
  - *Training and trainee programmes* — certificates and results summary; compliance copies.
  - *Machines and contractors* (retired ones) — profile plus their documents.
- **Also in the ZIP:** `data/*.csv` for Excel, `record.pdf` per record, manifest with checksums, `README.txt`.
- **In-app option (later):** an admin-only "Open archive" page where the admin drops the ZIP; it is read locally in the browser (nothing uploaded) and shown with the normal FirmiCore screens.
- **Phones:** large ZIPs are awkward on phones; the CSV and per-record PDFs are the fallback.

## 5b. Delivery targets ("upload to the user's own storage")

| Target | What exists today | What is needed | Notes |
|---|---|---|---|
| Signed download link by email + Settings → Archives | Nothing yet (design) | Cloud Function + page | Default. Link valid 7 days, regenerated on request; our copy kept 12 months |
| Customer's Google Drive | Browser-only Google sign-in for Sheets (`VITE_GOOGLE_OAUTH_CLIENT_ID`, scopes spreadsheets + drive.file) — gives a short-lived token while the admin is present | A server-side "connect Google Drive" flow with offline access (refresh token stored encrypted), resumable upload of multi-GB files from the bucket, `drive.file` scope (only files the app creates) | Uses the customer's own Drive quota, which also removes our download cost. Drive cannot run `index.html` — the user still downloads and extracts the ZIP. Upload the ZIP, not loose files |
| OneDrive / Dropbox / SFTP / customer S3 bucket | None | One connector each | Later, on demand; Enterprise |
| Local download only | — | — | Fallback |

Automatic upload cannot reuse today's Sheets sign-in because the monthly job runs when nobody is signed in.

## 6. Cost (USD / month, plan caps; typical use ≈ 25%)

| Plan (window) | Online | Archive + delivery | Without policy, year 3 / year 5 |
|---|---|---|---|
| Starter (12 mo) | $0.55 | $0.24 | $1.6 / $2.6 |
| Growth (18 mo) | $5.6 | $1.7 | $11 / $18 |
| Factory (24 mo) | $48 | $10.7 | $71 / $117 |

Assumptions: 16 MB per work order, 10 MB per breakdown (uncompressed), live library 1 / 7 / 60 GB, download ≈ $0.15/GB (one download per archive), 4% of stored files viewed per month. Compressing photos on upload (≈ −60% overall) would cut these further.
Resulting plan margins with this policy: Starter 84%, Growth 81%, Factory 76% at typical use; 81% / 75% / 65% with every record cap fully used.

## 7. Phases

| Phase | Work | Effort |
|---|---|---|
| 0 | Bucket lifecycle rule (Nearline at 12 months) | ½ day |
| 1 | Per-company `storageBytes` counter (finalize/delete triggers) + backfill — gives visibility | 3 days |
| 2 | `scheduleArchiveRuns`, `buildArchive`, manifest/viewer, verification, staging dry-run (no deletion) | 6–8 days |
| 3 | Admin page, emails, reminders, signed downloads, superadmin status | 4 days |
| 4 | `purgeArchived` + "archived" tiles across WO/breakdown/audit/Kaizen/requests/PO screens + PDF skip | 5–6 days |
| 5 | Final export on company close; churn purge; terms text | 2 days |
| 6 | Photo compression on upload; Drive delivery; thumbnails | optional |

Test in a staging project with a dry-run mode first; never enable purge for real companies before one full restore drill (open the ZIP offline, check checksums).

## 8. Risks / open decisions

- Terms must state the window, the 60-day auto-removal, the 12-month ZIP retention and the customer's retention responsibility — legal wording needed.
- Personal data in ZIPs (names, photos): downloads only via signed URLs to admins; consider encrypting parts.
- Large companies: single-function timeouts and memory (needs measurement); parts + Cloud Run Job fallback.
- Fixing the whole-catalog inventory listeners is a separate cost item (see pricing PDF).
- Two storage-rule inconsistencies to check: header says 50/100 MB caps but clients allow 200–500 MB for video; some roots are keyed by company id and some by plant id (the plants collection exists).
