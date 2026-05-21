const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { randomUUID } = require("crypto");
const { buildReportHtml } = require("./templates/base.template");
const { buildBreakdownSummaryTemplate } = require("./templates/breakdown-summary.template");
const { buildWorkOrderDetailTemplate } = require("./templates/work-order-detail.template");
const { buildMachineHistoryTemplate } = require("./templates/machine-history.template");
const { buildMachineHealthTemplate } = require("./templates/machine-health.template");
const { buildMaintenanceCostTemplate } = require("./templates/maintenance-cost.template");
const { buildTechnicianPerformanceTemplate } = require("./templates/technician-performance.template");
const { buildContractorPerformanceTemplate } = require("./templates/contractor-performance.template");
const { buildContractorInvoiceTemplate } = require("./templates/contractor-invoice.template");
const { buildInventoryUsageTemplate } = require("./templates/inventory-usage.template");
const { buildPartsConsumptionTemplate } = require("./templates/parts-consumption.template");
const { buildLowStockTemplate } = require("./templates/low-stock.template");
const { buildPmComplianceTemplate } = require("./templates/pm-compliance.template");
const { buildTrainingComplianceTemplate } = require("./templates/training-compliance.template");
const { buildSlaComplianceTemplate } = require("./templates/sla-compliance.template");
const { buildShiftHandoverTemplate } = require("./templates/shift-handover.template");
const { buildDowntimeAnalysisTemplate } = require("./templates/downtime-analysis.template");
const { buildExecutiveMonthlyTemplate } = require("./templates/executive-monthly.template");
const { buildSafetyNearMissTemplate } = require("./templates/safety-near-miss.template");
const { buildAuditTrailTemplate } = require("./templates/audit-trail.template");

const db = getFirestore();

const REPORTS = {
  breakdown_summary: { name: "Breakdown Summary Report", sources: ["breakdown_tickets"], build: buildBreakdownSummaryTemplate },
  work_order_detail: { name: "Work Order Detail Report", sources: ["work_orders"], build: buildWorkOrderDetailTemplate },
  machine_history: { name: "Machine History Report", sources: ["machines", "work_orders", "breakdown_tickets", "pm_history"], build: buildMachineHistoryTemplate },
  machine_health_score: { name: "Machine Health Score Report", sources: ["machine_health"], build: buildMachineHealthTemplate },
  maintenance_cost: { name: "Maintenance Cost Report", sources: ["work_orders", "inventory_logs", "contractor_jobs"], build: buildMaintenanceCostTemplate },
  technician_performance: { name: "Technician Performance Report", sources: ["work_orders"], build: buildTechnicianPerformanceTemplate },
  contractor_performance: { name: "Contractor Performance Report", sources: ["contractor_jobs", "contractor_profiles"], build: buildContractorPerformanceTemplate },
  contractor_invoice_comparison: { name: "Contractor Invoice Comparison", sources: ["contractor_jobs"], build: buildContractorInvoiceTemplate },
  inventory_usage: { name: "Inventory Usage Report", sources: ["inventory_logs"], build: buildInventoryUsageTemplate },
  parts_consumption: { name: "Parts Consumption Report", sources: ["inventory_logs", "work_orders"], build: buildPartsConsumptionTemplate },
  low_stock_alert: { name: "Low Stock Alert Report", sources: ["inventory"], build: buildLowStockTemplate },
  pm_compliance: { name: "PM Compliance Report", sources: ["pm_history", "pm_schedules"], build: buildPmComplianceTemplate },
  training_compliance: { name: "Training Compliance Report", sources: ["training_records"], build: buildTrainingComplianceTemplate },
  sla_compliance: { name: "SLA Compliance Report", sources: ["breakdown_tickets", "work_orders"], build: buildSlaComplianceTemplate },
  shift_handover_summary: { name: "Shift Handover Summary", sources: ["shift_handovers"], build: buildShiftHandoverTemplate },
  downtime_analysis: { name: "Downtime Analysis Report", sources: ["breakdown_tickets", "work_orders"], build: buildDowntimeAnalysisTemplate },
  executive_monthly: { name: "Executive Monthly Report", sources: ["analytics_monthly"], build: buildExecutiveMonthlyTemplate },
  safety_near_miss: { name: "Safety & Near-Miss Report", sources: ["shift_handovers", "breakdown_tickets"], build: buildSafetyNearMissTemplate },
  audit_trail: { name: "Audit Trail Report", sources: ["audit_logs"], build: buildAuditTrailTemplate },
};

async function requireAccess(uid, reportType) {
  const snap = await db.collection("users").doc(uid).get();
  const role = snap.data()?.role;
  if (!role) throw new HttpsError("permission-denied", "User profile is missing a role.");
  if (["admin", "plant_manager"].includes(role)) return snap.data();
  if (reportType === "audit_trail" && !["admin", "hr_officer"].includes(role)) {
    throw new HttpsError("permission-denied", "Only Admin and Compliance roles can export audit trail.");
  }
  if (["technician", "floor_operator", "trainee"].includes(role)) {
    throw new HttpsError("permission-denied", "This role cannot access reports.");
  }
  return snap.data();
}

function inRange(row, dateFrom, dateTo) {
  const value = row.createdAt || row.timestamp || row.date || row.generatedAt || row.completedAt;
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate().toISOString().slice(0, 10) : String(value).slice(0, 10);
  return date >= dateFrom && date <= dateTo;
}

async function queryReportData(reportType, companyId, dateFrom, dateTo) {
  const rows = [];
  for (const source of REPORTS[reportType].sources) {
    const snap = await db.collection(source).where("companyId", "==", companyId).limit(1000).get();
    snap.docs.forEach((doc) => {
      const row = { id: doc.id, ...doc.data(), sourceCollection: source };
      if (reportType !== "low_stock_alert" || Number(row.currentQty || row.stockQuantity || 0) <= Number(row.minStockLevel || row.reorderLevel || 0)) {
        rows.push(row);
      }
    });
  }
  return rows.filter((row) => inRange(row, dateFrom, dateTo));
}

exports.generateReport = onCall({ memory: "2GiB", timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  const started = Date.now();
  const { reportType, dateFrom, dateTo, filters = {}, companyId, options = {} } = request.data || {};
  if (!REPORTS[reportType] || !dateFrom || !dateTo || !companyId) {
    throw new HttpsError("invalid-argument", "reportType, dateFrom, dateTo, and companyId are required.");
  }

  const user = await requireAccess(request.auth.uid, reportType);
  const rows = await queryReportData(reportType, companyId, dateFrom, dateTo);
  const content = REPORTS[reportType].build(rows, options);
  const html = buildReportHtml({
    title: REPORTS[reportType].name,
    companyName: user.companyName || "PulseMaint Company",
    dateRange: `${dateFrom} to ${dateTo}`,
    generatedAt: new Date().toLocaleString(),
    content,
    orientation: options.orientation || "portrait",
    paperSize: options.paperSize || "A4",
  });

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: options.paperSize || "A4",
      landscape: options.orientation === "landscape",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const reportId = randomUUID();
    const storagePath = `reports/${companyId}/${reportId}.pdf`;
    const file = getStorage().bucket().file(storagePath);
    await file.save(pdf, { contentType: "application/pdf", resumable: false });
    const [downloadUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    await db.collection("report_history").doc(reportId).set({
      id: reportId,
      companyId,
      reportType,
      reportName: REPORTS[reportType].name,
      generatedBy: request.auth.uid,
      generatedByName: user.fullName || user.email || "Unknown user",
      generatedAt: FieldValue.serverTimestamp(),
      format: "pdf",
      dateRangeFrom: dateFrom,
      dateRangeTo: dateTo,
      filters,
      storageUrl: storagePath,
      downloadUrl,
      googleSheetsUrl: null,
      fileSizeBytes: pdf.length,
      generationTimeMs: Date.now() - started,
      status: "ready",
      errorMessage: null,
      pageCount: null,
      rowCount: rows.length,
      expiresAt,
    });
    await db.collection("audit_logs").add({
      companyId,
      timestamp: FieldValue.serverTimestamp(),
      userId: request.auth.uid,
      userName: user.fullName || user.email || "Unknown user",
      userRole: user.role,
      action: "EXPORT",
      entityType: "report",
      entityId: reportId,
      entityName: REPORTS[reportType].name,
      changes: null,
      ipAddress: request.rawRequest?.ip || null,
      userAgent: request.rawRequest?.headers["user-agent"] || null,
      sessionId: null,
    });
    return { reportId, downloadUrl, pageCount: null, generationTimeMs: Date.now() - started };
  } catch (err) {
    logger.error("generateReport failed", err);
    throw new HttpsError("internal", "Failed to generate report PDF.");
  } finally {
    if (browser) await browser.close();
  }
});
