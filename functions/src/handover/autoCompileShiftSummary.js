const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  db,
  asDate,
  countBy,
  normalizeStatus,
  getCompanyId,
  requireAuth,
} = require("./shared");

function isAfter(value, start) {
  const date = asDate(value);
  return Boolean(date && date >= start);
}

function isOpenStatus(status) {
  const normalized = normalizeStatus(status);
  return !["closed", "completed", "resolved", "cancelled", "archived"].includes(normalized);
}

function sum(items, selector) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

async function fetchCompanyDocs(collectionName, companyId) {
  const snap = await db.collection(collectionName).where("companyId", "==", companyId).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function toPendingWO(wo) {
  // Serialize dueDate as an ISO string: raw Firestore Timestamps come out of
  // the callable as {_seconds,_nanoseconds} objects, which the client turned
  // into Invalid Date (and then failed the handover submit).
  const dueDate = asDate(wo.dueDate || wo.slaDeadline);
  return {
    woId: wo.id,
    woNumber: wo.woNumber || wo.workOrderNumber || wo.id,
    machineName: wo.machineName || "",
    woType: wo.woType || wo.workOrderType || "work_order",
    priority: wo.priority || "medium",
    currentStatus: wo.status || "open",
    assignedTechnician: wo.assignedTechnicianName || wo.assignedToName || "",
    dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : null,
    supervisorNote: "",
    carryForwardStatus: "continue",
  };
}

function toBreakdownSnapshot(ticket, now) {
  const createdAt = asDate(ticket.createdAt) || now;
  return {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber || ticket.breakdownNumber || ticket.id,
    machineName: ticket.machineName || "",
    severity: ticket.severity || ticket.priority || "medium",
    currentState: ticket.status || ticket.currentState || "open",
    timeElapsedMinutes: Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / 60000)),
    assignedTechnician: ticket.assignedTechnicianName || ticket.assignedToName || "",
    supervisorNote: "",
    nextShiftPriority: normalizeStatus(ticket.severity).includes("critical") ? "urgent" : "continue",
  };
}

exports.autoCompileShiftSummary = onCall(async (request) => {
  requireAuth(request);
  const { companyId, shiftStartTime, supervisorId } = request.data || {};
  if (!companyId || !shiftStartTime) {
    throw new HttpsError("invalid-argument", "companyId and shiftStartTime are required.");
  }

  const shiftStart = new Date(shiftStartTime);
  if (Number.isNaN(shiftStart.getTime())) {
    throw new HttpsError("invalid-argument", "shiftStartTime must be an ISO date string.");
  }

  const now = new Date();
  const [breakdowns, workOrders, pmHistory, partsRequests, stockMovements, inventoryParts] = await Promise.all([
    fetchCompanyDocs("breakdown_tickets", companyId),
    fetchCompanyDocs("workOrders", companyId),
    fetchCompanyDocs("pm_history", companyId).catch(() => []),
    fetchCompanyDocs("partsRequests", companyId).catch(() => []),
    fetchCompanyDocs("stockMovements", companyId).catch(() => []),
    db.collection("companies").doc(companyId).collection("inventoryParts").get()
      .then((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), companyId })))
      .catch(() => []),
  ]);

  const companyBreakdowns = breakdowns.filter((item) => getCompanyId(item) === companyId);
  const companyWOs = workOrders.filter((item) => getCompanyId(item) === companyId);
  const openBreakdowns = companyBreakdowns.filter((item) => isOpenStatus(item.status || item.currentState));
  const pendingWOs = companyWOs.filter((item) => isOpenStatus(item.status || item.currentStatus));
  // SUP-021: the handover should gather breakdowns that occurred during this
  // shift (reported anytime from shift start to now), not just whatever is
  // still open company-wide at compile time.
  const breakdownsDuringShift = companyBreakdowns.filter((item) => isAfter(item.createdAt, shiftStart));
  // SUP-022: WOs gathered into the handover are scoped to this supervisor's
  // own activity during the shift (WOs they created), not the whole
  // company's open backlog. Falls back to the full during-shift set if no
  // supervisorId was supplied (older callers).
  const wosDuringShift = companyWOs.filter((item) => (
    isAfter(item.createdAt, shiftStart) && (!supervisorId || item.createdBy === supervisorId)
  ));
  const completedWOsThisShift = companyWOs.filter((item) => isAfter(item.completedAt || item.closedAt || item.resolvedAt, shiftStart));
  const partsThisShift = partsRequests.filter((item) => isAfter(item.createdAt || item.requestedAt, shiftStart));
  const stockIssuedThisShift = stockMovements.filter((item) => {
    const type = normalizeStatus(item.type || item.movementType);
    return type.includes("issue") && isAfter(item.createdAt || item.movedAt, shiftStart);
  });

  const stats = {
    breakdownsOpened: countBy(companyBreakdowns, (item) => isAfter(item.createdAt, shiftStart)),
    breakdownsClosed: countBy(companyBreakdowns, (item) => isAfter(item.closedAt || item.resolvedAt, shiftStart)),
    breakdownsCarriedOver: openBreakdowns.length,
    criticalBreakdowns: countBy(companyBreakdowns, (item) => isAfter(item.createdAt, shiftStart) && normalizeStatus(item.severity || item.priority).includes("critical")),
    highBreakdowns: countBy(companyBreakdowns, (item) => isAfter(item.createdAt, shiftStart) && normalizeStatus(item.severity || item.priority).includes("high")),
    wosOpened: countBy(companyWOs, (item) => isAfter(item.createdAt, shiftStart)),
    wosCompleted: completedWOsThisShift.length,
    wosPending: pendingWOs.length,
    pmsCompleted: countBy(pmHistory, (item) => isAfter(item.completedAt || item.createdAt, shiftStart)),
    pmsMissed: countBy(companyWOs, (item) => normalizeStatus(item.woType || item.workOrderType).includes("pm") && isOpenStatus(item.status) && asDate(item.dueDate) && asDate(item.dueDate) < now),
    partsIssued: stockIssuedThisShift.length || partsThisShift.length,
    partsIssuedValue: sum(stockIssuedThisShift, (item) => item.totalCost || item.totalValue || item.value),
    productionHoursLost: Number((sum(companyBreakdowns.filter((item) => isAfter(item.closedAt || item.resolvedAt, shiftStart)), (item) => item.downtimeMinutes || item.durationMinutes) / 60).toFixed(2)),
  };

  const lowStockAlerts = inventoryParts
    .filter((part) => Number(part.currentQty ?? part.quantityOnHand ?? 0) <= Number(part.minQty ?? part.minimumStock ?? 0))
    .map((part) => ({
      partId: part.id,
      partName: part.partName || part.name || "",
      currentQty: Number(part.currentQty ?? part.quantityOnHand ?? 0),
      minQty: Number(part.minQty ?? part.minimumStock ?? 0),
    }));

  return {
    stats,
    pendingWOs: wosDuringShift.map(toPendingWO),
    ongoingBreakdowns: breakdownsDuringShift.map((item) => toBreakdownSnapshot(item, now)),
    lowStockAlerts,
    shiftStartTime: shiftStart.toISOString(),
    compiledAt: now.toISOString(),
  };
});
