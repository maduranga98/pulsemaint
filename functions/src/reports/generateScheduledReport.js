const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const {randomUUID} = require("crypto");
const logger = require("firebase-functions/logger");
const {companyHasFeature} = require("../lib/planFeatures");
const {sendEmail, brandedEmail, platformSmtpPassword} = require("../lib/mailer");
const {escapeHtml} = require("../lib/access");

const db = getFirestore("default");

// Mirrors the collection map in src/services/reports.service.ts — must stay
// in sync with the real (camelCase) collection names the app writes to.
const SOURCE_MAP = {
  breakdown_summary: ["breakdown_tickets"],
  work_order_detail: ["workOrders"],
  machine_history: ["machines"],
  machine_health_score: ["machine_health"],
  maintenance_cost: ["workOrders", "stockMovements", "contractorJobs"],
  technician_performance: ["workOrders"],
  contractor_performance: ["contractorJobs"],
  contractor_invoice_comparison: ["contractorJobs"],
  inventory_usage: ["stockMovements"],
  parts_consumption: ["stockMovements"],
  low_stock_alert: ["inventoryParts"],
  pm_compliance: ["pm_history"],
  training_compliance: ["trainingAssignments"],
  // SLA deadlines live on work orders — breakdown tickets never carry one.
  sla_compliance: ["workOrders"],
  shift_handover_summary: ["shift_handovers"],
  downtime_analysis: ["breakdown_tickets"],
  executive_monthly: ["analytics_monthly"],
  safety_near_miss: ["shift_handovers"],
  audit_trail: ["audit_logs"],
};

/**
 * Compute the next scheduled run instant, at 04:00 UTC.
 * @param {string} frequency daily|weekly|monthly
 * @param {number|null} dayOfWeek 0-6, used for weekly
 * @param {number|null} dayOfMonth 1-28, used for monthly
 * @param {Date} from reference instant
 * @return {Date} next run instant
 */
function computeNextRunAt(frequency, dayOfWeek, dayOfMonth, from) {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 4, 0, 0));
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);

  if (frequency === "daily") return next;

  if (frequency === "weekly") {
    const target = dayOfWeek ?? 1;
    while (next.getUTCDay() !== target) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  const target = Math.min(Math.max(dayOfMonth ?? 1, 1), 28);
  next.setUTCDate(1);
  if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(target);
  return next;
}

/** Sources that describe current state rather than events in a period. */
const SNAPSHOT_SOURCES = new Set(["machines", "machine_health", "inventoryParts"]);
/** Reads per source per run — enough for a month of a large plant. */
const MAX_ROWS_PER_SOURCE = 20000;

/**
 * The period a run reports on: yesterday / the last 7 days / last month.
 * @param {string} frequency daily|weekly|monthly
 * @param {Date} now run time
 * @return {{from: Date, to: Date}} period
 */
function reportPeriod(frequency, now) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (frequency === "monthly") {
    return {
      from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)),
      to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1) - 1),
    };
  }
  const days = frequency === "weekly" ? 7 : 1;
  return {from: new Date(today.getTime() - days * 86400000), to: new Date(today.getTime() - 1)};
}

/**
 * The date that places a row in a period — the dashboards' rule (and the
 * in-app report builder's): a breakdown when reported, a PM occurrence when
 * due, a stock movement when performed, a work order's SLA by its deadline.
 * @param {object} row record
 * @param {string} source collection
 * @param {string} reportType report type
 * @return {Date|null} date
 */
function rowDate(row, source, reportType) {
  let raw;
  if (reportType === "sla_compliance") raw = row.slaDeadline;
  else if (source === "breakdown_tickets") raw = row.reportedAt ?? row.createdAt;
  else if (source === "pm_history") raw = row.dueDate ?? row.completedDate;
  else if (source === "stockMovements") raw = row.performedAt ?? row.createdAt;
  else raw = row.createdAt ?? row.timestamp ?? row.date ?? row.generatedAt ?? row.reportedAt ?? row.raisedAt ?? row.performedAt;
  if (raw && typeof raw.toDate === "function") return raw.toDate();
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * Fetch the rows of a schedule's report for its period (and plant), scoped
 * to its company. Event rows without a date are left out, like rows outside
 * the period; snapshot sources (machines, parts…) are taken as they are now.
 * @param {object} schedule report schedule
 * @param {{from: Date, to: Date}} period report period
 * @return {Promise<Array<Record<string, unknown>>>} flattened rows
 */
async function fetchRows(schedule, period) {
  const sources = SOURCE_MAP[schedule.reportType] || [];
  const plantId = schedule.plantId || null;
  const rows = [];
  for (const source of sources) {
    try {
      const snap = await db.collection(source).where("companyId", "==", schedule.companyId).limit(MAX_ROWS_PER_SOURCE).get();
      if (snap.size >= MAX_ROWS_PER_SOURCE) logger.warn(`generateScheduledReport: ${source} capped at ${MAX_ROWS_PER_SOURCE} rows`);
      snap.forEach((doc) => {
        const row = {id: doc.id, ...doc.data()};
        // Cancelled tickets were never breakdowns (the dashboards don't count them).
        if (source === "breakdown_tickets" && row.status === "cancelled") return;
        if (source === "analytics_monthly") {
          // The months the period covers (generateMonthlyAnalytics keeps them current).
          const first = period.from.toISOString().slice(0, 7);
          const last = period.to.toISOString().slice(0, 7);
          if (!row.month || row.month < first || row.month > last) return;
        } else if (!SNAPSHOT_SOURCES.has(source)) {
          const at = rowDate(row, source, schedule.reportType);
          if (!at || at < period.from || at > period.to) return;
        }
        if (plantId) {
          const rowPlant = row.machinePlantId ?? row.plantId ?? null;
          if (rowPlant !== plantId) return;
        }
        rows.push(row);
      });
    } catch (err) {
      logger.warn(`generateScheduledReport: failed reading ${source}`, err);
    }
  }
  return rows;
}

/**
 * Recipients limited to the company's own active members — a schedule
 * can't mail company data to outside addresses.
 * @param {string} companyId company id
 * @param {string[]} recipients requested addresses
 * @return {Promise<string[]>} allowed addresses
 */
async function allowedRecipients(companyId, recipients) {
  const snap = await db.collection(`companies/${companyId}/users`).get();
  const members = new Set(snap.docs
      .map((d) => d.data())
      .filter((u) => u.status !== "inactive" && u.email)
      .map((u) => String(u.email).trim().toLowerCase()));
  return [...new Set(recipients.map((r) => String(r || "").trim().toLowerCase()))].filter((r) => members.has(r));
}

/**
 * Build a CSV string from an array of plain-object rows, keeping only
 * primitive (string/number/boolean/date) fields — nested arrays/objects are
 * skipped so the export stays a flat, spreadsheet-friendly table.
 * @param {Array<Record<string, unknown>>} rows report rows
 * @return {string} CSV text
 */
function toCsv(rows) {
  if (rows.length === 0) return "No data available for this period.";

  const isPrimitive = (value) =>
    value === null || value === undefined ||
    ["string", "number", "boolean"].includes(typeof value) ||
    (value && typeof value.toDate === "function");

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.entries(row).forEach(([key, value]) => {
        if (isPrimitive(value)) set.add(key);
      });
      return set;
    }, new Set()),
  );

  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const str = value && typeof value.toDate === "function" ?
      value.toDate().toISOString() :
      String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, "\"\"")}"` : str;
  };

  const lines = [columns.join(",")];
  rows.forEach((row) => {
    lines.push(columns.map((col) => escape(row[col])).join(","));
  });
  return lines.join("\n");
}

exports.generateScheduledReport = onSchedule({schedule: "every 1 hours", secrets: [platformSmtpPassword]}, async () => {
  const now = new Date();
  const dueSnap = await db.collection("report_schedules")
      .where("active", "==", true)
      .where("nextRunAt", "<=", now)
      .limit(50)
      .get();

  if (dueSnap.empty) {
    logger.info("generateScheduledReport: no schedules due");
    return;
  }

  for (const scheduleDoc of dueSnap.docs) {
    const schedule = scheduleDoc.data();
    // Advance first: a failure further down (one bad address, storage) must
    // not leave the schedule due, or every recipient is mailed again hourly.
    await scheduleDoc.ref.update({
      lastRunAt: FieldValue.serverTimestamp(),
      nextRunAt: computeNextRunAt(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth, now),
    });
    try {
      // Scheduled reports are part of advanced analytics. A company that no
      // longer has it keeps its schedules but nothing runs; look again in a day
      // so locked schedules don't crowd out the due ones.
      if (!(await companyHasFeature(schedule.companyId, "advancedAnalytics"))) {
        await scheduleDoc.ref.update({nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)});
        continue;
      }
      const period = reportPeriod(schedule.frequency, now);
      const rows = await fetchRows(schedule, period);
      const csv = toCsv(rows);

      const reportId = randomUUID();
      const storagePath = `report_schedules/${scheduleDoc.id}/${reportId}.csv`;
      const file = getStorage().bucket().file(storagePath);
      await file.save(Buffer.from(csv, "utf8"), {contentType: "text/csv", resumable: false});
      const [downloadUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      await db.collection("report_history").doc(reportId).set({
        id: reportId,
        companyId: schedule.companyId,
        reportType: schedule.reportType,
        reportName: schedule.reportName,
        generatedBy: schedule.createdBy || "scheduled",
        generatedByName: "Scheduled Export",
        generatedAt: FieldValue.serverTimestamp(),
        format: "csv",
        dateRangeFrom: period.from.toISOString().slice(0, 10),
        dateRangeTo: period.to.toISOString().slice(0, 10),
        filters: schedule.filters || {},
        storageUrl: storagePath,
        downloadUrl,
        googleSheetsUrl: null,
        fileSizeBytes: Buffer.byteLength(csv),
        generationTimeMs: 0,
        status: "ready",
        errorMessage: null,
        pageCount: null,
        rowCount: rows.length,
        expiresAt,
      });

      const requested = Array.isArray(schedule.recipients) ? schedule.recipients : [];
      const recipients = await allowedRecipients(schedule.companyId, requested);
      if (recipients.length < requested.length) {
        logger.warn(`generateScheduledReport: ${requested.length - recipients.length} non-member recipient(s) skipped`, {scheduleId: scheduleDoc.id});
      }
      for (const to of recipients) {
        await sendEmail({
          to,
          subject: `FirmiCore — ${schedule.reportName} (scheduled export)`,
          html: brandedEmail(`
            <p style="margin:0 0 12px;color:#333;font-size:14px;">Your scheduled report is ready.</p>
            <p style="margin:0 0 12px;color:#333;font-size:14px;"><strong>${escapeHtml(schedule.reportName)}</strong> — ${rows.length} record(s), ${period.from.toISOString().slice(0, 10)} to ${period.to.toISOString().slice(0, 10)}.</p>
            <p style="margin:0;"><a href="${downloadUrl}" style="color:#1A56DB;">Download CSV</a></p>
          `),
          attachments: [{filename: `${String(schedule.reportName).replace(/[^\w.-]+/g, "_")}.csv`, content: csv, contentType: "text/csv"}],
        }).catch((err) => logger.error("generateScheduledReport: email failed", {scheduleId: scheduleDoc.id, err}));
      }
    } catch (err) {
      logger.error(`generateScheduledReport: schedule ${scheduleDoc.id} failed`, err);
    }
  }
});
