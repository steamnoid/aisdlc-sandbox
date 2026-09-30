import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { dayRangeToUtcRange, eachDayKey, isValidDayKey, dayKeyInZone } from "./daykeys.js";

const MAX_LENGTH = 1000;
const MAX_RANGE_DAYS = 400;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function assertValidText(rawText) {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw httpError(400, "Text must not be empty");
  }
  if (rawText.length > MAX_LENGTH) {
    throw httpError(400, `Max ${MAX_LENGTH} characters`);
  }
}

/**
 * @param {string} userId
 * @param {string} rawText
 * @param {string | null} [timezone=null]
 * @param {import("better-sqlite3").Database} [db]
 */
export function createEvent(userId, rawText, timezone = null, db = getDb()) {
  assertValidText(rawText);
  const event = {
    id: randomUUID(),
    user_id: userId,
    raw_text: rawText,
    created_at: new Date().toISOString(),
    timezone: typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC",
  };
  db.prepare("INSERT INTO events (id, user_id, raw_text, created_at, timezone) VALUES (?, ?, ?, ?, ?)").run(
    event.id,
    event.user_id,
    event.raw_text,
    event.created_at,
    event.timezone
  );
  return event;
}

export function listEvents(userId, db = getDb()) {
  return db
    .prepare("SELECT id, user_id, raw_text, created_at, timezone FROM events WHERE user_id = ? ORDER BY created_at DESC, id ASC")
    .all(userId);
}

function assertRangeArgs(fromDay, toDay, timeZone) {
  if (!isValidDayKey(fromDay)) throw httpError(400, "from must be a valid YYYY-MM-DD day");
  if (!isValidDayKey(toDay)) throw httpError(400, "to must be a valid YYYY-MM-DD day");
  if (typeof timeZone !== "string" || !timeZone.trim()) throw httpError(400, "timeZone is required");
  if (fromDay > toDay) throw httpError(400, "from must not be after to");
  if (eachDayKey(fromDay, toDay).length > MAX_RANGE_DAYS) {
    throw httpError(400, `Max ${MAX_RANGE_DAYS} days per range`);
  }
}

/**
 * Events of one user whose local calendar day (in the given time zone) falls
 * within the closed range [fromDay .. toDay], newest first.
 * @param {string} userId
 * @param {string} fromDay inclusive "YYYY-MM-DD"
 * @param {string} toDay inclusive "YYYY-MM-DD"
 * @param {string} timeZone IANA zone used for day boundaries
 * @param {import("better-sqlite3").Database} [db]
 */
export function listEventsBetween(userId, fromDay, toDay, timeZone, db = getDb()) {
  assertRangeArgs(fromDay, toDay, timeZone);
  const { startUtcIso, endExclusiveUtcIso } = dayRangeToUtcRange(fromDay, toDay, timeZone);
  return db
    .prepare(
      `SELECT id, user_id, raw_text, created_at, timezone FROM events
       WHERE user_id = ? AND created_at >= ? AND created_at < ?
       ORDER BY created_at DESC, id ASC`
    )
    .all(userId, startUtcIso, endExclusiveUtcIso);
}

/**
 * Permanently removes one event of one user.
 * A request for an event that no longer exists completes as already-deleted
 * instead of failing; an event owned by another account is refused untouched.
 * @param {string} userId
 * @param {string} eventId
 * @param {import("better-sqlite3").Database} [db]
 * @returns {{ status: "deleted" | "already_deleted" }}
 */
export function deleteEvent(userId, eventId, db = getDb()) {
  if (typeof eventId !== "string" || !eventId.trim()) {
    throw httpError(400, "eventId is required");
  }
  const row = db.prepare("SELECT user_id FROM events WHERE id = ?").get(eventId);
  if (!row) return { status: "already_deleted" };
  if (row.user_id !== userId) {
    throw httpError(404, "Not found");
  }
  db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
  return { status: "deleted" };
}

/**
 * Per-day saved-event counts of one user for the closed range [fromDay .. toDay].
 * Every day of the range is present; days without events map to 0.
 * @param {string} userId
 * @param {string} fromDay inclusive "YYYY-MM-DD"
 * @param {string} toDay inclusive "YYYY-MM-DD"
 * @param {string} timeZone IANA zone used for day boundaries
 * @param {import("better-sqlite3").Database} [db]
 * @returns {Record<string, number>}
 */
export function countEventsByDay(userId, fromDay, toDay, timeZone, db = getDb()) {
  assertRangeArgs(fromDay, toDay, timeZone);
  const { startUtcIso, endExclusiveUtcIso } = dayRangeToUtcRange(fromDay, toDay, timeZone);
  const rows = db
    .prepare("SELECT created_at FROM events WHERE user_id = ? AND created_at >= ? AND created_at < ?")
    .all(userId, startUtcIso, endExclusiveUtcIso);
  const counts = {};
  for (const key of eachDayKey(fromDay, toDay)) counts[key] = 0;
  for (const row of rows) {
    const key = dayKeyInZone(row.created_at, timeZone);
    if (key in counts) counts[key] += 1;
  }
  return counts;
}
