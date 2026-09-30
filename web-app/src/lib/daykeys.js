const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_MINUTE = 60_000;

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isValidDayKey(value) {
  if (typeof value !== "string" || !DAY_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const utcProbe = new Date(Date.UTC(year, month - 1, day));
  return (
    utcProbe.getUTCFullYear() === year &&
    utcProbe.getUTCMonth() === month - 1 &&
    utcProbe.getUTCDate() === day
  );
}

function assertDayKey(value, label) {
  if (!isValidDayKey(value)) {
    const err = new Error(`${label} must be a valid YYYY-MM-DD day`);
    err.status = 400;
    throw err;
  }
}

/**
 * Wall-clock parts of an instant inside a named IANA time zone.
 * @param {number} instantMs
 * @param {string} timeZone
 */
function wallParts(instantMs, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(instantMs));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Offset of a time zone from UTC in minutes at a given instant.
 * @param {number} instantMs
 * @param {string} timeZone
 */
function tzOffsetMinutes(instantMs, timeZone) {
  const p = wallParts(instantMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instantMs) / MS_PER_MINUTE);
}

/**
 * Local calendar day of an instant in the given time zone as "YYYY-MM-DD".
 * @param {number | string | Date} instant
 * @param {string} [timeZone]
 */
export function dayKeyInZone(instant, timeZone = "UTC") {
  const ms = typeof instant === "number" ? instant : new Date(instant).getTime();
  const p = wallParts(ms, timeZone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

/**
 * Today's day key in the given time zone.
 * @param {string} [timeZone]
 */
export function todayDayKey(timeZone = "UTC") {
  return dayKeyInZone(Date.now(), timeZone);
}

function startOfDayInstant(dayKey, timeZone) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, day);
  let offset = tzOffsetMinutes(naive, timeZone);
  let instant = naive - offset * MS_PER_MINUTE;
  const recheck = tzOffsetMinutes(instant, timeZone);
  if (recheck !== offset) {
    offset = recheck;
    instant = naive - offset * MS_PER_MINUTE;
  }
  return instant;
}

export function nextDayKey(dayKey) {
  assertDayKey(dayKey, "day");
  const [year, month, date] = dayKey.split("-").map(Number);
  const rolled = new Date(Date.UTC(year, month - 1, date + 1));
  const y = rolled.getUTCFullYear();
  const m = String(rolled.getUTCMonth() + 1).padStart(2, "0");
  const d = String(rolled.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Inclusive UTC bounds of a local calendar day: [startUtcIso, endExclusiveUtcIso).
 * Handles DST transitions (23h and 25h days) via an offset re-check pass.
 * @param {string} dayKey
 * @param {string} [timeZone]
 * @returns {{startUtcIso: string, endExclusiveUtcIso: string}}
 */
export function dayKeyToUtcRange(dayKey, timeZone = "UTC") {
  assertDayKey(dayKey, "day");
  const startMs = startOfDayInstant(dayKey, timeZone);
  const endMs = startOfDayInstant(nextDayKey(dayKey), timeZone);
  return {
    startUtcIso: new Date(startMs).toISOString(),
    endExclusiveUtcIso: new Date(endMs).toISOString(),
  };
}

/**
 * Inclusive UTC bounds of a closed local day range [fromDay .. toDay].
 * @param {string} fromDay
 * @param {string} toDay
 * @param {string} [timeZone]
 * @returns {{startUtcIso: string, endExclusiveUtcIso: string}}
 */
export function dayRangeToUtcRange(fromDay, toDay, timeZone = "UTC") {
  assertDayKey(fromDay, "from");
  assertDayKey(toDay, "to");
  if (fromDay > toDay) {
    const err = new Error("from must not be after to");
    err.status = 400;
    throw err;
  }
  const { startUtcIso } = dayKeyToUtcRange(fromDay, timeZone);
  const { endExclusiveUtcIso } = dayKeyToUtcRange(toDay, timeZone);
  return { startUtcIso, endExclusiveUtcIso };
}

/**
 * Every day key of a closed range in order.
 * @param {string} fromDay
 * @param {string} toDay
 * @returns {string[]}
 */
export function eachDayKey(fromDay, toDay) {
  assertDayKey(fromDay, "from");
  assertDayKey(toDay, "to");
  if (fromDay > toDay) {
    const err = new Error("from must not be after to");
    err.status = 400;
    throw err;
  }
  const keys = [];
  let cursor = fromDay;
  while (cursor <= toDay) {
    keys.push(cursor);
    cursor = nextDayKey(cursor);
  }
  return keys;
}

/**
 * Second click on an earlier day becomes the start; equal days collapse to a one-day range.
 * @param {string} firstDay already-selected starting day
 * @param {string} secondDay newly clicked day
 * @returns {{start: string, end: string}}
 */
export function normalizeRange(firstDay, secondDay) {
  assertDayKey(firstDay, "start");
  assertDayKey(secondDay, "end");
  return secondDay < firstDay
    ? { start: secondDay, end: firstDay }
    : { start: firstDay, end: secondDay };
}

/**
 * @typedef {{kind:"none"}|{kind:"day",day:string}|{kind:"range",start:string,end:string}} SelectionState
 */

/**
 * Calendar click model: first tap selects a single day, second tap closes a range,
 * a tap while a range is active restarts with a fresh single-day selection.
 * @param {SelectionState} selection
 * @param {string} clickedDay
 * @returns {SelectionState}
 */
export function applyDayClick(selection, clickedDay) {
  assertDayKey(clickedDay, "clicked day");
  if (selection.kind === "none" || selection.kind === "range") {
    return { kind: "day", day: clickedDay };
  }
  const range = normalizeRange(selection.day, clickedDay);
  return { kind: "range", ...range };
}

/**
 * @typedef {{year:number, month:number}} YearMonth month is 1-based
 */

/**
 * The default visible window: current month followed by the two previous ones.
 * @param {Date|number|string} [now]
 * @param {string} [timeZone]
 * @returns {YearMonth[]}
 */
export function defaultWindow(now = new Date(), timeZone = "UTC") {
  const key = dayKeyInZone(now, timeZone);
  return shiftWindow({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) }, 0);
}

export const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Three consecutive months ENDING `offset` months from the anchor, so the
 * anchor itself is the most recent visible month (default view: current plus
 * the two previous ones).
 * @param {YearMonth} anchor last visible month
 * @param {number} offset months to shift the window by
 * @returns {YearMonth[]}
 */
export function shiftWindow(anchor, offset) {
  const lastMonthIndex = anchor.year * 12 + (anchor.month - 1) + offset;
  return [-2, -1, 0].map((i) => {
    const idx = lastMonthIndex + i;
    return { year: Math.floor(idx / 12), month: (((idx % 12) + 12) % 12) + 1 };
  });
}

/**
 * Grid cells for one month, Monday-first, padded to whole weeks with muted
 * out-of-month filler days so every row has 7 cells.
 * @param {YearMonth} yearMonth
 * @returns {{dayKey:string|null,label:number,inMonth:boolean}[]}
 */
export function buildMonthGrid({ year, month }) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const jsDow = firstOfMonth.getUTCDay();
  const mondayIndex = (jsDow + 6) % 7;
  const cells = [];
  for (let i = 0; i < mondayIndex; i++) cells.push({ dayKey: null, label: 0, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ dayKey: `${year}-${mm}-${dd}`, label: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ dayKey: null, label: 0, inMonth: false });
  return cells;
}

/**
 * First and last day key present in a window of months (for counts fetching).
 * @param {YearMonth[]} months
 * @returns {{from:string,to:string}|null}
 */
export function windowBounds(months) {
  if (months.length === 0) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const first = months[0];
  const last = months[months.length - 1];
  const lastDay = new Date(Date.UTC(last.year, last.month, 0)).getUTCDate();
  return {
    from: `${first.year}-${pad(first.month)}-01`,
    to: `${last.year}-${pad(last.month)}-${pad(lastDay)}`,
  };
}

/**
 * Month title like "August 2026".
 * @param {YearMonth} yearMonth
 * @param {string} [locale]
 */
export function formatMonthLabel({ year, month }, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

/**
 * Selection as URL query params: ?day=KEY | ?from=..&to=.. | none.
 * @param {SelectionState} selection
 * @returns {Record<string,string>}
 */
export function selectionToParams(selection) {
  if (selection.kind === "day") return { day: selection.day };
  if (selection.kind === "range") return { from: selection.start, to: selection.end };
  return {};
}

/**
 * Restore a selection from key lookups (e.g. URLSearchParams.get). Anything
 * invalid or inverted falls back to no selection.
 * @param {(key:string)=>string|null} get
 * @returns {SelectionState}
 */
export function selectionFromParams(get) {
  const day = get("day");
  if (isValidDayKey(day)) return { kind: "day", day };
  const from = get("from");
  const to = get("to");
  if (isValidDayKey(from) && isValidDayKey(to)) {
    if (from > to) return { kind: "none" };
    return { kind: "range", start: from, end: to };
  }
  return { kind: "none" };
}
