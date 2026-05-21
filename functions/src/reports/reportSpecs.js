const commonColumns = [
  {label: "ID", keys: ["id", "ticketNumber", "woNumber", "number"]},
  {label: "Machine", keys: ["machineName", "machine", "machineId"]},
  {label: "Department", keys: ["departmentName", "department"]},
  {label: "Severity", keys: ["severity", "priority", "criticality"]},
  {label: "Status", keys: ["status", "slaStatus"]},
  {label: "Created", keys: ["createdAt", "timestamp", "date"]},
  {label: "Owner", keys: ["technicianName", "assignedTechnician", "userName", "reportedBy"]},
  {label: "Cost", keys: ["totalCost", "totalValue", "cost", "contractorInvoiceAmount"]},
];

const specs = {
  breakdown_summary: {kpis: ["Total Breakdowns", "Critical", "Resolved", "Hours Lost"], chartText: "Breakdown trend, type mix, and severity mix.", columns: commonColumns},
  work_order_detail: {kpis: ["Total WOs", "Critical", "Completed", "Cost"], chartText: "WO status distribution and work-order type breakdown.", columns: commonColumns},
  machine_history: {kpis: ["Events", "Critical", "Completed", "Cost"], chartText: "Machine health and history timeline.", columns: commonColumns},
  machine_health_score: {kpis: ["Machines", "Critical", "Healthy", "Avg Score"], chartText: "Fleet health distribution and six-month trend.", columns: commonColumns},
  maintenance_cost: {kpis: ["Records", "Critical", "Completed", "Total Cost"], chartText: "Monthly parts, labor, and contractor cost breakdown.", columns: commonColumns},
  technician_performance: {kpis: ["Jobs", "Critical", "Completed", "Cost"], chartText: "Technician SLA ranking and workload split.", columns: commonColumns},
  contractor_performance: {kpis: ["Jobs", "Critical", "Completed", "Total Cost"], chartText: "Contractor scoreboard and SLA compliance.", columns: commonColumns},
  contractor_invoice_comparison: {kpis: ["Invoices", "Critical", "Paid", "Variance"], chartText: "Invoice variance distribution.", columns: commonColumns},
  inventory_usage: {kpis: ["Issues", "Critical", "Completed", "Issued Value"], chartText: "Issues by category and daily trend.", columns: commonColumns},
  parts_consumption: {kpis: ["Parts", "Critical", "Completed", "Value"], chartText: "Top consumed parts.", columns: commonColumns},
  low_stock_alert: {kpis: ["Below Min", "Critical", "Out Of Stock", "Deficit"], chartText: "Urgency distribution by stock level.", columns: commonColumns},
  pm_compliance: {kpis: ["Scheduled", "Critical", "On Time", "Compliance"], chartText: "Monthly PM compliance and breakdown correlation.", columns: commonColumns},
  training_compliance: {kpis: ["Records", "Expired", "Certified", "Compliance"], chartText: "Training matrix by machine and operator.", columns: commonColumns},
  sla_compliance: {kpis: ["Tickets", "Breached", "Within SLA", "Avg Time"], chartText: "SLA compliance by severity and trend.", columns: commonColumns},
  shift_handover_summary: {kpis: ["Handovers", "Critical", "Accepted", "Safety"], chartText: "Shift acceptance and watch flag activity.", columns: commonColumns},
  downtime_analysis: {kpis: ["Incidents", "Critical", "Resolved", "Hours Lost"], chartText: "Daily downtime and top affected machines.", columns: commonColumns},
  executive_monthly: {kpis: ["Breakdowns", "Critical", "PM Done", "Cost"], chartText: "Executive KPI trends, costs, and action items.", columns: commonColumns},
  safety_near_miss: {kpis: ["Incidents", "Critical", "Closed", "Follow-ups"], chartText: "Safety incidents by machine and shift.", columns: commonColumns},
  audit_trail: {kpis: ["Actions", "Deletes", "Exports", "Users"], chartText: "Action type mix and most active users.", columns: commonColumns},
};

module.exports = {specs};
