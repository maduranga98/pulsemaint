const { escapeHtml } = require("./base.template");

function valueAt(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "-";
}

function formatValue(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toLocaleString();
  if (value && typeof value === "object") return escapeHtml(JSON.stringify(value)).slice(0, 180);
  return escapeHtml(value);
}

function buildTable(rows, columns) {
  const safeRows = rows.slice(0, 250);
  return `<table><thead><tr>${columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("")}</tr></thead><tbody>${
    safeRows.length
      ? safeRows.map((row) => `<tr>${columns.map((col) => `<td>${formatValue(valueAt(row, col.keys))}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${columns.length}">No records matched this report configuration.</td></tr>`
  }</tbody></table>`;
}

function buildGenericReportContent(spec, rows, options = {}) {
  const total = rows.length;
  const critical = rows.filter((row) => /critical/i.test(String(row.severity || row.priority || row.criticality || ""))).length;
  const completed = rows.filter((row) => /complete|closed|ready|resolved/i.test(String(row.status || ""))).length;
  const value = rows.reduce((sum, row) => sum + Number(row.totalCost || row.totalValue || row.cost || row.invoiceAmount || 0), 0);
  return `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-value">${total}</div><div class="kpi-label">${escapeHtml(spec.kpis[0] || "Total Records")}</div></div>
      <div class="kpi-card"><div class="kpi-value">${critical}</div><div class="kpi-label">${escapeHtml(spec.kpis[1] || "Critical")}</div></div>
      <div class="kpi-card"><div class="kpi-value">${completed}</div><div class="kpi-label">${escapeHtml(spec.kpis[2] || "Completed")}</div></div>
      <div class="kpi-card"><div class="kpi-value">${Math.round(value).toLocaleString()}</div><div class="kpi-label">${escapeHtml(spec.kpis[3] || "Value")}</div></div>
    </div>
    ${options.includeCharts ? `<div class="section-title">Charts</div><div class="chart-placeholder">${escapeHtml(spec.chartText || "Chart-ready summary generated from source data.")}</div>` : ""}
    ${options.includeDataTable !== false ? `<div class="section-title">Detail Table</div>${buildTable(rows, spec.columns)}` : ""}
  `;
}

module.exports = { buildGenericReportContent };
