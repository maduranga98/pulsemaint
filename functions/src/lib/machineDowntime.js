/**
 * Server copy of src/lib/machineDowntime.ts (computeDowntimeEvents) — the
 * app's single definition of machine downtime, so server aggregates (MOE
 * snapshots) agree with the dashboards. Keep both in sync; the parity test
 * src/lib/__tests__/machineDowntimeParity.test.ts runs both on the same data.
 *
 * - Breakdown: from the moment it was reported (the machine stopped) until the
 *   linked work order was signed off. A breakdown whose machine was still
 *   running when reported only loses time once repair work starts.
 * - Any other maintenance: from the work order's actual start until sign-off.
 * - Work orders raised for a breakdown are counted once, through the breakdown.
 */

const OPEN_BREAKDOWN = (status) => !["resolved", "closed", "cancelled"].includes(String(status ?? ""));

/**
 * @param {*} value Timestamp / Date / millis / ISO / {seconds}
 * @return {Date|null} date
 */
function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ms = (d) => (d ? d.getTime() : null);

/**
 * @param {object} wo work order
 * @return {Date|null} the supervisor's sign-off, else its close time
 */
function workOrderSignOff(wo) {
  return toDateValue(wo.supervisorSignOffAt) || toDateValue(wo.closedAt);
}

const hoursBetween = (start, end) => Math.max(0, (end.getTime() - start.getTime()) / 3600000);

/**
 * @param {object} wo work order
 * @return {string[]} breakdown ids it was raised for
 */
function linkedBreakdownIds(wo) {
  const ids = new Set();
  if (wo.linkedBreakdownId) ids.add(String(wo.linkedBreakdownId));
  if (Array.isArray(wo.linkedBreakdownIds)) wo.linkedBreakdownIds.forEach((i) => i && ids.add(String(i)));
  return [...ids];
}

/**
 * @param {object[]} breakdowns breakdown tickets (with id)
 * @param {object[]} workOrders work orders (with id)
 * @param {Date} [now] current time
 * @param {Function} [legacyBreakdownHours] estimate for tickets with nothing to measure from
 * @return {object[]} downtime events {kind, sourceId, machineId, start, end, ongoing, hours, row}
 */
function computeDowntimeEvents(breakdowns, workOrders, now = new Date(), legacyBreakdownHours = () => 0) {
  const events = [];
  const wosByBreakdown = new Map();
  const claimedWoIds = new Set();
  const breakdownIds = new Set(breakdowns.map((b) => String(b.id)));
  workOrders.forEach((wo) => {
    const ids = linkedBreakdownIds(wo);
    ids.forEach((id) => {
      if (!wosByBreakdown.has(id)) wosByBreakdown.set(id, []);
      wosByBreakdown.get(id).push(wo);
    });
    if (ids.some((id) => breakdownIds.has(id))) claimedWoIds.add(String(wo.id));
  });
  const woById = new Map(workOrders.map((w) => [String(w.id), w]));
  breakdowns.forEach((b) => {
    const wo = b.linkedWOId ? woById.get(String(b.linkedWOId)) : undefined;
    if (!wo) return;
    const list = wosByBreakdown.get(String(b.id)) || [];
    if (!list.includes(wo)) list.push(wo);
    wosByBreakdown.set(String(b.id), list);
    claimedWoIds.add(String(wo.id));
  });

  breakdowns.forEach((b) => {
    if (String(b.status) === "cancelled") return;
    const reported = toDateValue(b.reportedAt ?? b.createdAt);
    if (!reported) return;
    const linked = wosByBreakdown.get(String(b.id)) || [];
    const stopped = b.machineStillRunning !== true;

    let start = reported;
    if (!stopped) {
      const starts = linked.map((w) => ms(toDateValue(w.actualStartTime))).filter((x) => x !== null);
      start = starts.length ? new Date(Math.min(...starts)) : null;
    }

    const signOffs = linked.map((w) => ms(workOrderSignOff(w))).filter((x) => x !== null);
    const allSignedOff = linked.length > 0 && linked.every((w) => workOrderSignOff(w));
    let end = allSignedOff && signOffs.length ? new Date(Math.max(...signOffs)) : null;
    if (!end && linked.length === 0) {
      end = toDateValue(b.closedAt) || toDateValue(b.resolvedAt);
    }

    let hours;
    let ongoing = false;
    if (start && end) {
      hours = hoursBetween(start, end);
    } else if (start && OPEN_BREAKDOWN(b.status) && (linked.length > 0 || stopped)) {
      end = now;
      ongoing = true;
      hours = hoursBetween(start, now);
    } else {
      hours = legacyBreakdownHours(b);
      start = start || reported;
      end = new Date(start.getTime() + hours * 3600000);
    }

    events.push({
      kind: "breakdown",
      sourceId: String(b.id),
      machineId: b.machineId != null ? String(b.machineId) : null,
      start,
      end,
      ongoing,
      hours,
      row: b,
    });
  });

  workOrders.forEach((wo) => {
    if (claimedWoIds.has(String(wo.id))) return;
    if (String(wo.status) === "CANCELLED") return;
    const start = toDateValue(wo.actualStartTime);
    if (!start) return;
    const end = workOrderSignOff(wo);
    if (!end) return;
    events.push({
      kind: "maintenance",
      sourceId: String(wo.id),
      machineId: wo.machineId != null ? String(wo.machineId) : null,
      start,
      end,
      ongoing: false,
      hours: hoursBetween(start, end),
      row: wo,
    });
  });

  return events;
}

/**
 * Minutes of [windowStart, windowEnd] covered by the given events, with
 * overlapping events (two tickets on one machine at once) counted once.
 * @param {object[]} events downtime events of one machine
 * @param {Date} windowStart window start
 * @param {Date} windowEnd window end
 * @return {number} minutes
 */
function downtimeMinutesInWindow(events, windowStart, windowEnd) {
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  const spans = events
      .map((e) => [Math.max(ws, e.start.getTime()), Math.min(we, e.end.getTime())])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = null;
  let curEnd = null;
  spans.forEach(([s, e]) => {
    if (curEnd === null || s > curEnd) {
      if (curEnd !== null) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) {
      curEnd = e;
    }
  });
  if (curEnd !== null) total += curEnd - curStart;
  return total / 60000;
}

module.exports = {computeDowntimeEvents, downtimeMinutesInWindow, toDateValue, workOrderSignOff};
