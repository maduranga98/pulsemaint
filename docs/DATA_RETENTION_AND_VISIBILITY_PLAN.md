# Data retention & visibility plan (research + proposal — nothing implemented)

Request (summarised): closed work orders (WO), work permits (WP) and breakdowns stay visible to supervisors for 30 days after closing, and to plant managers and admins for 1 year; supervisors can read older ones only by requesting access, approved by their plant manager or admin. Completed training detail is cleared once certified (certificate generated after sign-off), trainee-programme data is cleared after certification, notifications are cleared once everyone has read them; everything analytics needs is kept, other data is not stored.

All findings below are from the code in this repository (`firestore.rules`, `functions/`, `src/services`, `src/hooks`, `src/types`).

## 1. What the code does today (relevant facts)

| Area | Today |
|---|---|
| Closed WOs | Stay forever. Supervisors read WOs for their site **and** all company WOs (the rule exists so the Analytics page works), and can **delete** them; plant managers read company-wide; admin everything; safety officer, HR and others have company-wide reads (`firestore.rules` ~198–262). |
| Closed breakdowns | Stay forever; readable by 10 roles (floor operator, technician, trainee, store keeper, HR, safety officer…). Only admin can delete. |
| Work permits / safety cases | Readable by every company member; managed by `canManageSafety()` roles; stay forever. |
| Record access requests | **Already built**: a supervisor (or other staff) raises a `record_access` staff request; a plant manager or admin shares chosen WOs/breakdowns for 24 h–30 d; a snapshot copy goes into `record_access_grants`; `purgeExpiredRecordGrants` deletes it every 15 min. Approvers are the plant managers of the requester's plant and the admins (`listRequestRecipients`). **Only `work_order` and `breakdown` are supported — not work permits.** |
| Analytics | The Analytics page computes in the browser from **raw** collections (`analyticsAggregation.ts`: `workOrders`, `breakdown_tickets`, contractor jobs, PM history, machines…, up to 3,000 docs per collection, ranges up to 12 months or "all"). `analytics_daily`, `analytics_monthly`, `machine_health` exist but are only a fallback and hold only a few totals. |
| Other readers of closed records | `recalculateMtbf` reads **all closed breakdowns of a machine**; `recalculateContractorMetrics` reads all jobs of a contractor; `claudeJson` (AI root cause) reads the last 8 closed WOs of the machine; PM compliance, SLA, MTTR, technician statistics, MOE, machine profile history, Maintenance History (plant manager, all time) all read closed records. |
| Training | `trainingAssignments` hold lesson progress, **every quiz attempt with per-question answers**, practical sign-off, certificate id. `generateTrainingCertificate` creates a top-level `trainingCertificates` doc when status becomes `certified` (certificate PDFs are built in the browser from that doc; `pdfUrl` is empty). Training analytics (`teamPerformance.service.ts`, `useComplianceData`, dashboards) read **all assignments** plus certificates. |
| Trainee programme | `traineeProgrammes`, `weekendSummaries` (with file attachments), `programAssignments`; certification writes `traineeProgrammeCertificates` (final mark + per-module scores, PDF in Storage). |
| Notifications | One doc per event with `recipientRoles`, `recipientUserIds`, and per-user `readBy[]`. Admin and plant manager are appended to every targeted notification. Only admin may delete (rules). Nothing is ever deleted. |
| Cleanup jobs | Only reports (30 days) and expired record-access grants. |

## 2. Proposed policy

| Data | Supervisors and other roles | Plant manager and admin | At 1 year | Kept for analytics |
|---|---|---|---|---|
| Closed WO | Visible 30 days after `closedAt`; afterwards only through an approved access request | Full record + attachments online for 1 year | ZIP archive with attachments to the admin (see `DATA_ARCHIVE_AND_EXPORT_PLAN.md`), then removed online | Closed-record digest + monthly rollups, forever |
| Closed breakdown | same | same | same | same |
| Closed work permit | same, **safety officer treated like plant manager** | same | ZIP to admin; digest kept (see risk R2) | digest (type, area, duration, issuer, overdue flag) |
| Closed safety case (suggested, not requested) | same as permits | same | same | digest |
| Training assignment, certified | Trainee and manager see the certificate | Certificate + training digest | Detail (progress, quiz answers) deleted 30 days after certificate | Certificate (score, sign-off, expiry) + digest: module, trainee, dates, attempts, best score, time, signer |
| Training not certified (failed, expired, in progress) | kept until resolved | kept | 12 months after last activity → digest only | digest |
| Trainee programme after certification | — | Certificate with final mark and module scores | Programme, weekend summaries and their files deleted 30 days after certification | Certificate + digest |
| Notifications | Cleared when read by every recipient; hard cap 30 days | same | — | none |

"Closed" means `closedAt` is set (work orders SIGNED_OFF/CLOSED, breakdown closed, permit closed, safety case closed).

## 3. What would break if we just deleted (and the fix)

1. **Analytics.** Raw closed records are the analytics source. Deleting them empties 3M/6M/12M and "all" views, MTBF/MTTR, contractor and technician scores, MOE and the AI "past repairs on this machine". **Fix first:** write a compact *closed-record digest* at close time (≈1–2 KB: ids, machine, type, severity, opened/closed, downtime hours, labour and parts cost, root-cause code, technician and contractor ids, SLA met, PM link, parts used with cost) plus monthly/machine/technician rollups; point the analytics code, `recalculateMtbf`, contractor metrics and AI history at digests; **backfill all existing closed records into digests before any deletion.** Digest volume is trivial (100,000 records ≈ 200 MB ≈ $0.04/month) and it also cuts dashboard reads dramatically.
2. **Supervisor access is enforced by rules, not by the UI.** Supervisors can currently read everything company-wide. The 30-day window must be a rule on closed records (`closedAt` within 30 days, or status not closed) with matching query filters, and supervisor delete rights on WOs should be removed. The supervisor's company-wide Analytics read must move to rollups/digests.
3. **Other roles read closed records too** (technician history, trainee, floor operator, store keeper, HR contractor scoreboard, safety officer). Decide that all non-plant-manager/admin roles share the 30-day window, with safety officer as the permit/safety-case exception.
4. **Training:** compliance and retraining logic must run from certificates and the training digest, not assignments. Separate bug found: `checkRetrainingTrigger` listens to `companies/{id}/trainingCertificates/{id}` but certificates are written to the **top-level** `trainingCertificates`, so the "retraining due" notification never fires today — fix before relying on certificate expiry.
5. **Notifications:** many are role-targeted, so "read by everyone" is not knowable later. Resolve role recipients to user ids when the notification is created, delete when every resolved recipient has read it (and at 30 days regardless). Deletion needs a Cloud Function (rules allow only admin).
6. **Record-access requests** keep working but cover only items still online (≈ last year). Older ones: the admin hands over the archive ZIP. Extend grants to `work_permit` and include the attachments in what the requester can open.

## 4. Risks and things to decide

- **R1 Irreversible deletion.** Existing customers have years of history. Needs: notice and grace (e.g. 90 days), an admin ZIP first, a Firestore export/point-in-time-recovery backup before the first purge, per-company opt-in at launch, a legal-hold flag, an audit log, and a dry-run mode.
- **R2 Permits and safety cases.** Permit-to-work and incident records are commonly required to be kept for years by safety regulation. Deleting them at 1 year without a retained copy could expose the company. I recommend: keep a permanent digest, deliver the ZIP to the admin, and get local legal advice before deleting any permit/incident detail. Same caution for training records that prove operator competence (the certificate keeps score, sign-off and observations; per-question answers are the only thing deleted).
- **R3 Supervisor usefulness.** Supervisors repairing a machine benefit from "what was done last time". Option: a one-line machine repair log (date, fault, root cause, fix) visible to supervisors and technicians, without photos, costs or people. Your call.
- **R4 Financial records.** Parts cost is on the WO digest, but `stockMovements`, `purchaseOrders` and invoices may be needed for accounting/tax. They were not in your list; I'd keep them (small).
- **R5 Reopened records.** A closed WO that is reopened must refresh/remove its digest and become fully visible again.
- **R6 "Plant manager and admin only".** Several roles (HR for contractor analytics, safety officer, store keeper) read closed data today; confirm they should lose per-record access (aggregates stay).

## 5. Other collections — proposed class (confirm the starred ones)

- **Keep (master):** `machines`, `inventoryParts`, `suppliers`, `contractors`, `departments`, `plants`, `trainingModules`, `trainingContentLibrary`, `triage*` flows/templates, `shift_config`, `siteConfig`, users.
- **Keep (analytics/knowledge):** `analytics_*`, `machine_health`, `technician_status`, `moeSnapshots`, `pm_history`*, `rca`* (root-cause knowledge), `machineHistory`*, `conditionReadings`*, `tpm_*`, `shift_stats`, `kaizen_cards`* (ideas), `evaluations`*, `audit_sessions`* (completed audits).
- **Keep (certificates/compliance):** `trainingCertificates`, `traineeProgrammeCertificates`, `safetyCertificates`, `serviceLetterHistory`, `audit_logs`.
- **Apply the 30-day/1-year rule:** `workOrders`, `breakdown_tickets`, `work_permits`, `safety_cases`*, `permits`*, `partsRequests`*, `partReturns`*, `contractorJobs`* (closed), `staff_requests` (already hidden 7 days after close), `shift_handovers`* / `shift_sessions`*.
- **Short-lived, purge:** `notifications`, `po_notifications`, `report_history` (30 d, exists), `moeRecalcQueue` (processed), `inventoryImportSessions`, `aiUsage`, expired `contractorInvitations`/`inviteTokens`, `triageSessions`*, `triage_assessment_results`* (keep scores only).

## 6. Phases (after you approve)

1. Digest + rollup writers, backfill of existing closed records, switch analytics/MTBF/contractor/AI/PM-compliance to digests (parallel run and compare totals). ≈ 2 weeks.
2. Rules: 30-day window for non-plant-manager/admin roles, remove supervisor delete, grants for work permits + attachments. ≈ 4–5 days.
3. Training and trainee clean-up functions, fix the retraining trigger path, store certificate PDFs at issue. ≈ 4 days.
4. Notification resolution + purge. ≈ 2 days.
5. Archive ZIP + 1-year purge (from `DATA_ARCHIVE_AND_EXPORT_PLAN.md`), grace period, backups, audit log. ≈ 3–4 weeks.
6. Update FEATURES.md, CLAUDE.md, customer terms, admin help text.

Impact on pricing: with a uniform 1-year online window the plan windows (12/18/24 months) in the pricing chart can become "extra online history" add-ons; hot storage and dashboard reads both fall, which raises margins.
