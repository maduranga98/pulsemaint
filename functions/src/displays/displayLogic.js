/**
 * Pure logic for the department display board (the shareable TV link).
 * No Firestore here, so it can be unit tested (src/lib/__tests__/departmentDisplay.test.ts).
 *
 * The board shows, for ONE department of ONE plant, only machine names, a
 * status and times — never what happened (no descriptions), people, costs or notes:
 *  - breakdowns: open tickets as Reported → Attended → In progress, and "Fixed today":
 *    tickets resolved today plus tickets signed off (closed) today. Cancelled tickets are never shown.
 *  - maintenance today: work running now and work still to do today.
 *  - scheduled: everything planned after today, up to a year ahead.
 * Overdue work (planned before today and not started) is never shown.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_DAYS = 365;
const MAX_BREAKDOWNS = 60;
const MAX_MAINTENANCE = 80;
const MAX_SCHEDULED = 400;
const FRESH_MS = 30 * 60 * 1000;

const BREAKDOWN_OPEN_STATUSES = [
  "reported", "acknowledged", "triage_in_progress", "assigned", "en_route",
  "repair_in_progress", "on_hold_parts", "on_hold_approval",
];
const BREAKDOWN_QUERY_STATUSES = [...BREAKDOWN_OPEN_STATUSES, "resolved"];
const WO_QUERY_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD_PARTS", "ON_HOLD_APPROVAL"];

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * @param {*} v Firestore Timestamp, Date, millisecond number or null
 * @return {number|null} milliseconds since epoch
 */
function toMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v._seconds === "number") return v._seconds * 1000;
  return null;
}

/**
 * The visitor's own "today" window. The browser sends it so it matches the
 * floor's clock; the server only checks it is plausible.
 * @param {number} now server time (ms)
 * @param {*} startMs start of the viewer's day
 * @param {*} endMs start of the viewer's next day
 * @return {{start:number,end:number}} the window (server-side UTC day when invalid)
 */
function dayWindow(now, startMs, endMs) {
  const s = Number(startMs);
  const e = Number(endMs);
  const okSpan = Number.isFinite(s) && Number.isFinite(e) && e - s >= 23 * 3600e3 && e - s <= 25 * 3600e3;
  const okNear = okSpan && Math.abs(s - now) <= 36 * 3600e3 && s <= now && now < e;
  if (okNear) return {start: s, end: e};
  const start = Math.floor(now / DAY_MS) * DAY_MS;
  return {start, end: start + DAY_MS};
}

/**
 * @param {object} d a work order / PM schedule
 * @return {number} planned duration in minutes (0 when unknown)
 */
function durationMinutes(d) {
  const n = Number(d.estimatedDuration);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(d.estimatedDurationUnit === "days" ? n * 24 * 60 : n * 60);
}

const samePlant = (rec, plantId) => (rec == null ? null : rec) === (plantId == null ? null : plantId);

/**
 * @param {object} t a breakdown_tickets document
 * @param {number} now current time
 * @param {{start:number,end:number}} win today's window
 * @return {object|null} the board row, or null when the ticket is not shown
 */
function breakdownRow(t, now, win) {
  const status = String(t.status || "");
  let key; let step; let fixedAt = null;
  if (status === "reported" || status === "acknowledged" || status === "triage_in_progress") {
    key = "reported"; step = 0;
  } else if (status === "assigned" || status === "en_route") {
    key = "attended"; step = 1;
  } else if (status === "repair_in_progress" || status === "on_hold_parts" || status === "on_hold_approval") {
    key = "in_progress"; step = 2;
  } else if (status === "resolved") {
    const at = toMs(t.resolvedAt) ?? toMs(t.updatedAt);
    if (at == null || at < win.start || at >= win.end) return null;
    key = "fixed"; step = 3; fixedAt = at;
  } else {
    return null; // closed (shown under completed), cancelled, anything else
  }
  const reportedAt = toMs(t.reportedAt) ?? now;
  return {
    machine: text(t.machineName, 80) || "—",
    status: key,
    step,
    at: reportedAt,
    fixedAt,
    fresh: key === "reported" && now - reportedAt < FRESH_MS,
  };
}

/**
 * A breakdown that was signed off (closed) today counts as "Fixed today", with the sign-off time as its fixed time.
 * @param {object} t a breakdown_tickets document with status closed
 * @param {number} now current time
 * @param {{start:number,end:number}} win today's window
 * @return {object|null} the Fixed row, or null when it was not signed off today
 */
function signedOffRow(t, now, win) {
  if (String(t.status || "") !== "closed") return null;
  const closedAt = toMs(t.closedAt);
  if (closedAt == null || closedAt < win.start || closedAt >= win.end) return null;
  return {
    machine: text(t.machineName, 80) || "—",
    status: "fixed",
    step: 3,
    at: toMs(t.reportedAt) ?? closedAt,
    fixedAt: closedAt,
    fresh: false,
  };
}

/**
 * @param {object} w a workOrders document
 * @param {number} now current time
 * @param {{start:number,end:number}} win today's window
 * @return {{kind:string,row:object}|null} maintenance (today) or scheduled (later) row, or null
 */
function workOrderRow(w, now, win) {
  if (w.woType === "BREAKDOWN") return null; // the breakdown ticket already shows it
  const status = String(w.status || "");
  const from = toMs(w.scheduledStart) ?? toMs(w.dueDate);
  if (from == null) return null;
  const mins = durationMinutes(w);
  const base = {
    machine: text(w.machineName, 80) || "—",
    type: w.woType === "PREVENTIVE" ? "PM" : "WO",
    from,
    to: mins ? from + mins * 60000 : from,
  };
  if (status === "IN_PROGRESS" || status === "ON_HOLD_PARTS" || status === "ON_HOLD_APPROVAL") {
    return {kind: "maintenance", row: {...base, status: "running"}};
  }
  if (status !== "OPEN" && status !== "ASSIGNED") return null;
  if (from < win.start) return null; // overdue: not shown
  if (from < win.end) return {kind: "maintenance", row: {...base, status: "scheduled_today"}};
  if (from < win.start + SCHEDULE_DAYS * DAY_MS) return {kind: "scheduled", row: base};
  return null;
}

/**
 * @param {object} p a pm_schedules document
 * @param {number} now current time
 * @param {{start:number,end:number}} win today's window
 * @return {{kind:string,row:object}|null} maintenance (today) or scheduled (later) row, or null
 */
function pmScheduleRow(p, now, win) {
  if (p.status !== "active") return null;
  const from = toMs(p.nextDueDate);
  if (from == null || from < win.start) return null; // overdue: not shown
  if (p.noEndDate === false) {
    const end = toMs(p.endDate);
    if (end != null && from > end) return null;
  }
  const mins = durationMinutes(p);
  const row = {
    machine: text(p.machineName, 80) || "—",
    type: "PM",
    from,
    to: mins ? from + mins * 60000 : from,
  };
  if (from < win.end) return {kind: "maintenance", row: {...row, status: "scheduled_today"}};
  if (from < win.start + SCHEDULE_DAYS * DAY_MS) return {kind: "scheduled", row};
  return null;
}

/**
 * Builds the board payload from already-fetched department records.
 * @param {{now:number,win:{start:number,end:number},plantId:?string,tickets:object[],closedTickets:object[],workOrders:object[],pmSchedules:object[]}} input records
 * @return {{breakdowns:object[],maintenance:object[],scheduled:object[]}} what the board shows
 */
function buildDisplayPayload({now, win, plantId, tickets, closedTickets = [], workOrders, pmSchedules}) {
  const breakdowns = [];
  for (const t of tickets) {
    if (!samePlant(t.machinePlantId, plantId)) continue;
    const r = breakdownRow(t, now, win);
    if (r) breakdowns.push(r);
  }
  for (const t of closedTickets) {
    if (!samePlant(t.machinePlantId, plantId)) continue;
    const r = signedOffRow(t, now, win);
    if (r) breakdowns.push(r);
  }
  const maintenance = [];
  const scheduled = [];
  const put = (res) => {
    if (!res) return;
    (res.kind === "maintenance" ? maintenance : scheduled).push(res.row);
  };
  for (const w of workOrders) {
    if (!samePlant(w.machinePlantId, plantId)) continue;
    put(workOrderRow(w, now, win));
  }
  for (const p of pmSchedules) {
    if (!samePlant(p.plantId, plantId)) continue;
    put(pmScheduleRow(p, now, win));
  }
  // Open ones first (newest report first), then Fixed today (latest fix first).
  breakdowns.sort((a, b) => ((a.fixedAt ? 1 : 0) - (b.fixedAt ? 1 : 0)) || (a.fixedAt ? b.fixedAt - a.fixedAt : b.at - a.at));
  maintenance.sort((a, b) => a.from - b.from);
  scheduled.sort((a, b) => a.from - b.from);
  return {
    breakdowns: breakdowns.slice(0, MAX_BREAKDOWNS),
    maintenance: maintenance.slice(0, MAX_MAINTENANCE),
    scheduled: scheduled.slice(0, MAX_SCHEDULED),
  };
}

module.exports = {
  DAY_MS, SCHEDULE_DAYS, BREAKDOWN_QUERY_STATUSES, WO_QUERY_STATUSES,
  toMs, dayWindow, durationMinutes, breakdownRow, signedOffRow, workOrderRow, pmScheduleRow, buildDisplayPayload,
};
