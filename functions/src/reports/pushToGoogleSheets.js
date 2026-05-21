const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { google } = require("googleapis");

const db = getFirestore("default");
const sources = {
  breakdown_summary: ["breakdown_tickets"],
  work_order_detail: ["work_orders"],
  machine_history: ["machines"],
  machine_health_score: ["machine_health"],
  maintenance_cost: ["work_orders", "inventory_logs", "contractor_jobs"],
  technician_performance: ["work_orders"],
  contractor_performance: ["contractor_jobs"],
  contractor_invoice_comparison: ["contractor_jobs"],
  inventory_usage: ["inventory_logs"],
  parts_consumption: ["inventory_logs", "work_orders"],
  low_stock_alert: ["inventory"],
  pm_compliance: ["pm_history", "pm_schedules"],
  training_compliance: ["training_records"],
  sla_compliance: ["breakdown_tickets", "work_orders"],
  shift_handover_summary: ["shift_handovers"],
  downtime_analysis: ["breakdown_tickets", "work_orders"],
  executive_monthly: ["analytics_monthly"],
  safety_near_miss: ["shift_handovers", "breakdown_tickets"],
  audit_trail: ["audit_logs"],
};

function stringify(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

async function fetchRows(reportType, companyId) {
  const rows = [];
  for (const source of sources[reportType] || []) {
    const snap = await db.collection(source).where("companyId", "==", companyId).limit(1000).get();
    snap.docs.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
  }
  return rows;
}

exports.pushToGoogleSheets = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  const { reportType, dateFrom, dateTo, companyId, googleAccessToken } = request.data || {};
  if (!reportType || !dateFrom || !dateTo || !companyId || !googleAccessToken) {
    throw new HttpsError("invalid-argument", "reportType, dateFrom, dateTo, companyId, and googleAccessToken are required.");
  }
  const rows = await fetchRows(reportType, companyId);
  const headers = rows[0] ? Object.keys(rows[0]).slice(0, 24) : ["message"];
  const values = rows.length
    ? [headers, ...rows.slice(0, 1000).map((row) => headers.map((header) => stringify(row[header])))]
    : [["message"], ["No records matched this report configuration."]];
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: googleAccessToken });
  const sheets = google.sheets({ version: "v4", auth });
  const title = `PulseMaint - ${reportType} - ${dateFrom} to ${dateTo}`;
  const created = await sheets.spreadsheets.create({
    requestBody: { properties: { title } },
  });
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new HttpsError("internal", "Google did not return a spreadsheet ID.");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: { values },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.04, green: 0.09, blue: 0.16 } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
        { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
        { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: Math.max(headers.length, 1) } } },
      ],
    },
  });
  return { spreadsheetId, sheetsUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` };
});
