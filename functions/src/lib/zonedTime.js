/**
 * Calendar days in a company's own timezone (companies/{id}.timezone, IANA;
 * UTC when unset). Server aggregates bucket by these local days so an event
 * at 01:00 in Colombo is counted on that day, not the previous UTC day.
 */

/**
 * @param {string|null|undefined} timeZone IANA zone
 * @return {string} a zone Intl accepts (falls back to UTC)
 */
function safeZone(timeZone) {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", {timeZone}).format(new Date());
    return timeZone;
  } catch (err) {
    return "UTC";
  }
}

/**
 * Offset (ms) of `timeZone` from UTC at instant `date`.
 * @param {Date} date instant
 * @param {string} timeZone IANA zone
 * @return {number} local − UTC in ms
 */
function zoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timeZone),
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type) => Number((parts.find((p) => p.type === type) || {}).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Local calendar date (YYYY-MM-DD) of an instant.
 * @param {Date} date instant
 * @param {string} timeZone IANA zone
 * @return {string} date key
 */
function localDateKey(date, timeZone) {
  const local = new Date(date.getTime() + zoneOffsetMs(date, timeZone));
  return local.toISOString().slice(0, 10);
}

/**
 * [start, end] instants of a local calendar day.
 * @param {string} dateKey YYYY-MM-DD
 * @param {string} timeZone IANA zone
 * @return {{start: Date, end: Date}} day window (end inclusive, ms precision)
 */
function localDayWindow(dateKey, timeZone) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guessStart = Date.UTC(y, m - 1, d);
  const guessNext = Date.UTC(y, m - 1, d + 1);
  // Offsets at the day boundaries (they differ across a DST change).
  const start = guessStart - zoneOffsetMs(new Date(guessStart), timeZone);
  const next = guessNext - zoneOffsetMs(new Date(guessNext), timeZone);
  return {start: new Date(start), end: new Date(next - 1)};
}

module.exports = {safeZone, zoneOffsetMs, localDateKey, localDayWindow};
