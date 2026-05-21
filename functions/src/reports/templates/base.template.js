function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHtml(options) {
  const orientation = options.orientation || "portrait";
  const paperSize = options.paperSize || "A4";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    @page { size: ${paperSize} ${orientation}; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; color: #1E293B; background: white; }
    .page { min-height: 297mm; position: relative; padding-bottom: 42px; }
    .header { background: #0A1628; color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
    .header-title h1 { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: white; }
    .header-title p { font-size: 12px; color: #8BA3BF; margin-top: 4px; }
    .header-meta { text-align: right; font-size: 11px; color: #8BA3BF; }
    .content { padding: 32px 40px; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 40px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 9px; color: #64748B; background: white; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card { border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; }
    .kpi-value { font-family: 'Sora', sans-serif; font-size: 30px; font-weight: 700; color: #0A1628; }
    .kpi-label { font-size: 11px; color: #64748B; margin-top: 4px; }
    .section-title { font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: #1A56DB; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #1A56DB; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10px; }
    thead tr { background: #F0F4F8; }
    thead th { padding: 8px 10px; text-align: left; font-weight: 600; color: #0A1628; text-transform: uppercase; font-size: 8px; letter-spacing: .4px; border-bottom: 2px solid #E2E8F0; }
    tbody tr:nth-child(even) { background: #F8FAFC; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
    .badge-red { background: #FEF2F2; color: #DC2626; }
    .badge-amber { background: #FFFBEB; color: #D97706; }
    .badge-green { background: #F0FDF4; color: #16A34A; }
    .badge-blue { background: #EFF6FF; color: #2563EB; }
    .chart-placeholder { border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 24px; background: #F8FAFC; color: #64748B; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-title">
        <h1>${escapeHtml(options.title)}</h1>
        <p>${escapeHtml(options.companyName)} · ${escapeHtml(options.dateRange)}</p>
      </div>
      <div class="header-meta">
        <div style="font-family:Sora;font-size:16px;font-weight:700;color:#00C2FF;">PulseMaint</div>
        <div>pulsemaint.com</div>
      </div>
    </div>
    <div class="content">${options.content}</div>
    <div class="footer">
      <span>Generated: ${escapeHtml(options.generatedAt)}</span>
      <span>Confidential · ${escapeHtml(options.companyName)}</span>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildReportHtml, escapeHtml };
