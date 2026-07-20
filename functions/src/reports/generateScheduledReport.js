const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const {randomUUID} = require("crypto");
const logger = require("firebase-functions/logger");
const {sendEmail, brandedEmail} = require("../lib/mailer");

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
  sla_compliance: ["breakdown_tickets"],
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

/**
 * Fetch raw rows for a schedule's report type, scoped to its company.
 * @param {string} reportType report type key
 * @param {string} companyId company id
 * @return {Promise<Array<Record<string, unknown>>>} flattened rows
 */
async function fetchRows(reportType, companyId) {
  const sources = SOURCE_MAP[reportType] || [];
  const rows = [];
  for (const source of sources) {
    try {
      const snap = await db.collection(source).where("companyId", "==", companyId).limit(1000).get();
      snap.forEach((doc) => rows.push({id: doc.id, ...doc.data()}));
    } catch (err) {
      logger.warn(`generateScheduledReport: failed reading ${source}`, err);
    }
  }
  return rows;
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
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [columns.join(",")];
  rows.forEach((row) => {
    lines.push(columns.map((col) => escape(row[col])).join(","));
  });
  return lines.join("\n");
}

exports.generateScheduledReport = onSchedule("every 1 hours", async () => {
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
    try {
      const rows = await fetchRows(schedule.reportType, schedule.companyId);
      const csv = toCsv(rows);

      const reportId = randomUUID();
      const storagePath = `report_schedules/${scheduleDoc.id}/${reportId}.csv`;
      const file = getStorage().bucket().file(storagePath);
      await file.save(Buffer.from(csv, "utf8"), {contentType: "text/csv", resumable: false});
      const [downloadUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      await db.collection("report_history").doc(reportId).set({
        id: reportId,
        companyId: schedule.companyId,
        reportType: schedule.reportType,
        reportName: schedule.reportName,
        generatedBy: schedule.createdBy || "scheduled",
        generatedByName: "Scheduled Export",
        generatedAt: FieldValue.serverTimestamp(),
        format: "csv",
        dateRangeFrom: "",
        dateRangeTo: "",
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

      const recipients = Array.isArray(schedule.recipients) ? schedule.recipients : [];
      for (const to of recipients) {
        await sendEmail({
          to,
          subject: `PulseMaint — ${schedule.reportName} (scheduled export)`,
          html: brandedEmail(`
            <p style="margin:0 0 12px;color:#333;font-size:14px;">Your scheduled report is ready.</p>
            <p style="margin:0 0 12px;color:#333;font-size:14px;"><strong>${schedule.reportName}</strong> — ${rows.length} record(s).</p>
            <p style="margin:0;"><a href="${downloadUrl}" style="color:#1A56DB;">Download CSV</a></p>
          `),
          attachments: [{filename: `${schedule.reportName.replace(/\s+/g, "_")}.csv`, content: csv, contentType: "text/csv"}],
        });
      }

      await scheduleDoc.ref.update({
        lastRunAt: FieldValue.serverTimestamp(),
        nextRunAt: computeNextRunAt(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth, now),
      });
    } catch (err) {
      logger.error(`generateScheduledReport: schedule ${scheduleDoc.id} failed`, err);
    }
  }
});
