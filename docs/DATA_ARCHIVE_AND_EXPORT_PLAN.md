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

- **Online window** (counted from the record's close date): Starter 12 months, Growth 18, Factory 24, Enterprise per contract (default 24). Extra 12 months is an add-on ($5 / $15 / $60 per month).
- **Archived:** files of closed work orders and breakdowns, completed audits (`audit_*`, `audits`), closed Kaizen, closed staff requests, paid PO invoices.
- **Never archived:** live master files (machine photos/manuals, contractor documents and certificates, warranty files, training content and library, logo), safety training submissions and certificates (compliance). A per-company **legal hold** flag stops archiving and removal.
- **Records stay in Firestore** (searchable, with an `archive: {archiveId, archivedAt}` marker); only the files leave.
- **Removal rule:** online copies are removed after the admin confirms the download, or 60 days after the first notice (stated in the terms). The ZIP itself stays 12 months in Archive-class storage for re-download, then is deleted with a final notice. Nothing is removed unless the ZIP's checksums were verified.
- **Retention guidance** (docs/STORAGE_AND_DATA_LIFECYCLE.si.md §5): work orders and breakdowns 5+ years, safety 5–7 years — after handover the customer holds the legal copy; say so in the terms.
- **Company closure / churn:** `platformDeleteCompany` currently erases everything. Add a final export first; expired trials and cancelled accounts: read-only 90 days, then purge.

## 4. Archive package

```
FirmiCore-Archive-<company>-<period>-part1of3.zip      (≤ 2 GB per part, ZIP64)
 ├─ index.html          offline viewer: search by date / machine / number, no login, no server
 ├─ viewer/             bundled JS & CSS (no CDN)
 ├─ records/<number>/   record.pdf (same content as the Maintenance History export), record.json, media/<original files>
 ├─ data/               records.csv, records.json
 ├─ manifest.json       archive id, company, period, counts, SHA-256 of every file, format version
 └─ README.txt          how to open and verify
```
Standard formats only (PDF, JPEG, PNG, MP4, CSV, JSON, HTML).
`record.pdf` should reuse the existing renderer (`src/utils/reports/pdf/maintenanceRecordPdf.ts`, jsPDF in the browser today); the server side needs either a port or the existing puppeteer setup used by `generateReport`.

## 5. Pipeline (Cloud Functions + Cloud Tasks)

1. `scheduleArchiveRuns` (monthly, per company): select records closed before `now − window`, not yet archived, not on legal hold; group by quarter; create `companies/{id}/archives/{archiveId}` (status `planned`, estimate of bytes/files).
2. `buildArchive` (one Cloud Task per part): resolve object paths from URLs/`storagePath`, stream objects into a ZIP written directly to `archives/{companyId}/{archiveId}/part-N.zip` (cold storage class), compute SHA-256, re-read and verify, set `ready`. Parts keep each task inside the function timeout; very large companies may need a Cloud Run Job (timeouts to be confirmed).
3. `notifyArchiveReady`: email to company admins (existing mailer) and an in-app page **Settings → Data archives** (admin only): list, size, period, short-lived signed download links (regenerated on request), checksum, "I have downloaded and verified" button.
4. Reminders at 14 and 30 days; superadmin console shows per-company archive status.
5. `purgeArchived`: after confirmation or 60 days, delete the original objects (Admin SDK bypasses create-only rules), batch-update Firestore markers, write `archiveAuditLog` (who confirmed, when, bytes freed).
6. Every file-showing component renders an "Archived in <archive> — download from Settings" tile when the record has the marker; PDF export must skip archived images gracefully.

Optional later: deliver the ZIP to the customer's Google Drive (OAuth for Sheets already exists); keep 320 px thumbnails online so lists still show previews; re-import for restore.

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
