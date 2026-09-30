import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../web-app/src/lib/db.js";
import * as auth from "../../web-app/src/lib/auth.js";
import * as events from "../../web-app/src/lib/events.js";

describe("WELLBEINGT-188 month paging with per-day event counts — approved Product AC", () => {
  let db: ReturnType<typeof getTestDb>;
  const TZ = "Europe/Warsaw";

  beforeEach(() => {
    db = getTestDb();
  });

  function newUser(email: string) {
    return auth.registerUser(email, "password123", db);
  }

  function seedEvent(userId: string, rawText: string, iso: string) {
    const event = events.createEvent(userId, rawText, null, db);
    db.prepare("UPDATE events SET created_at = ? WHERE id = ?").run(iso, event.id);
    return event;
  }

  it("AC-3 countEventsByDay counts saved events per local day and shows zero for empty days", () => {
    const user = newUser("counts@example.com");
    seedEvent(user.id, "before range", "2026-08-19T21:59:00Z"); // local Aug 19 23:59 → outside
    seedEvent(user.id, "utc-prev-day", "2026-08-19T22:00:00Z"); // local Aug 20 00:00 → day one
    seedEvent(user.id, "evening note", "2026-08-20T21:30:00Z"); // local Aug 20 23:30
    seedEvent(user.id, "last-day note", "2026-08-26T21:00:00Z"); // local Aug 26 23:00
    seedEvent(user.id, "after range", "2026-08-26T22:00:00Z"); // local Aug 27 00:00 → outside

    const counts = events.countEventsByDay(user.id, "2026-08-20", "2026-08-26", TZ, db);

    expect(Object.keys(counts)).toHaveLength(7);
    expect(counts["2026-08-20"]).toBe(2);
    expect(counts["2026-08-21"]).toBe(0);
    expect(counts["2026-08-26"]).toBe(1);
  });

  it("AC-2 counts stay correct for months paged far outside the default window", () => {
    const user = newUser("history@example.com");
    seedEvent(user.id, "old note", "2025-01-15T11:00:00Z");
    const counts = events.countEventsByDay(user.id, "2025-01-01", "2025-01-31", "UTC", db);
    expect(counts["2025-01-15"]).toBe(1);
    expect(counts["2025-01-14"]).toBe(0);
  });

  it("invalid range arguments are rejected with status 400", () => {
    const user = newUser("validate@example.com");
    expect(() => events.countEventsByDay(user.id, "2026-13-40", "2026-08-26", TZ, db)).toThrow(
      /from must be a valid/
    );
    expect(() => events.listEventsBetween(user.id, "2026-08-26", "2026-08-20", TZ, db)).toThrow(/after/);
    expect(() => events.listEventsBetween(user.id, "2026-08-20", "2026-08-26", "", db)).toThrow(
      /timeZone is required/
    );
    expect(
      () => events.countEventsByDay(user.id, "2019-01-01", "2026-08-26", TZ, db)
    ).toThrow(/Max 400 days/);
  });
});

describe("WELLBEINGT-189 single-day timeline filtering — approved Product AC", () => {
  let db: ReturnType<typeof getTestDb>;
  const TZ = "Europe/Warsaw";

  beforeEach(() => {
    db = getTestDb();
  });

  function newUser(email: string) {
    return auth.registerUser(email, "password123", db);
  }

  function seedEvent(userId: string, rawText: string, iso: string) {
    const event = events.createEvent(userId, rawText, null, db);
    db.prepare("UPDATE events SET created_at = ? WHERE id = ?").run(iso, event.id);
    return event;
  }

  it("AC-4 selecting a single day returns only that local day's events, newest first", () => {
    const user = newUser("single@example.com");
    seedEvent(user.id, "previous day", "2026-08-22T20:00:00Z"); // local Aug 22
    const morning = seedEvent(user.id, "morning walk", "2026-08-23T05:00:00Z"); // local Aug 23 07:00
    const night = seedEvent(user.id, "late journal", "2026-08-23T21:00:00Z"); // local Aug 23 23:00
    seedEvent(user.id, "next day", "2026-08-23T22:00:00Z"); // local Aug 24

    const result = events.listEventsBetween(user.id, "2026-08-23", "2026-08-23", TZ, db);
    expect(result.map((e: { id: string }) => e.id)).toEqual([night.id, morning.id]);
  });
});

describe("WELLBEINGT-190 optional date-range filtering — approved Product AC", () => {
  let db: ReturnType<typeof getTestDb>;
  const TZ = "Europe/Warsaw";

  beforeEach(() => {
    db = getTestDb();
  });

  function newUser(email: string) {
    return auth.registerUser(email, "password123", db);
  }

  function seedEvent(userId: string, rawText: string, iso: string) {
    const event = events.createEvent(userId, rawText, null, db);
    db.prepare("UPDATE events SET created_at = ? WHERE id = ?").run(iso, event.id);
    return event;
  }

  it("AC-5 an inclusive start→end range keeps both endpoint days and drops the rest", () => {
    const user = newUser("range@example.com");
    seedEvent(user.id, "too early", "2026-08-15T21:00:00Z"); // local Aug 15 23:00 → outside
    seedEvent(user.id, "day one", "2026-08-16T10:00:00Z"); // local Aug 16
    seedEvent(user.id, "middle", "2026-08-18T12:00:00Z"); // local Aug 18
    seedEvent(user.id, "last day", "2026-08-20T09:00:00Z"); // local Aug 20
    seedEvent(user.id, "too late", "2026-08-20T22:00:00Z"); // local Aug 21

    const texts = events
      .listEventsBetween(user.id, "2026-08-16", "2026-08-20", TZ, db)
      .map((e: { raw_text: string }) => e.raw_text);
    expect(texts).toEqual(["last day", "middle", "day one"]);
  });

  it("AC-8 a same-day start=end range behaves like the single-day filter", () => {
    const user = newUser("sameday@example.com");
    seedEvent(user.id, "in range", "2026-08-20T10:00:00Z");
    seedEvent(user.id, "out of range", "2026-08-21T10:00:00Z");
    const texts = events
      .listEventsBetween(user.id, "2026-08-20", "2026-08-20", TZ, db)
      .map((e: { raw_text: string }) => e.raw_text);
    expect(texts).toEqual(["in range"]);
  });
});

describe("WELLBEINGT-192 own-data scoping for calendar counts and filters — approved Product AC", () => {
  let db: ReturnType<typeof getTestDb>;
  const TZ = "UTC";

  beforeEach(() => {
    db = getTestDb();
  });

  function newUser(email: string) {
    return auth.registerUser(email, "password123", db);
  }

  function seedEvent(userId: string, rawText: string, iso: string) {
    const event = events.createEvent(userId, rawText, null, db);
    db.prepare("UPDATE events SET created_at = ? WHERE id = ?").run(iso, event.id);
    return event;
  }

  it("AC-9 day counts include only the logged-in user's own events", () => {
    const alice = newUser("alice@example.com");
    const bob = newUser("bob@example.com");
    seedEvent(alice.id, "alice private", "2026-08-20T10:00:00Z");
    seedEvent(bob.id, "bob private", "2026-08-20T11:00:00Z");
    seedEvent(bob.id, "bob private 2", "2026-08-20T12:00:00Z");

    const aliceCounts = events.countEventsByDay(alice.id, "2026-08-20", "2026-08-20", TZ, db);
    const bobCounts = events.countEventsByDay(bob.id, "2026-08-20", "2026-08-20", TZ, db);

    expect(aliceCounts["2026-08-20"]).toBe(1);
    expect(bobCounts["2026-08-20"]).toBe(2);
  });

  it("AC-9 filtered timeline results include only the logged-in user's own events", () => {
    const alice = newUser("alice-filter@example.com");
    const bob = newUser("bob-filter@example.com");
    seedEvent(alice.id, "alice note", "2026-08-20T10:00:00Z");
    seedEvent(bob.id, "bob note", "2026-08-20T11:00:00Z");

    const aliceView = events.listEventsBetween(alice.id, "2026-08-20", "2026-08-20", TZ, db);
    expect(aliceView.map((e: { raw_text: string }) => e.raw_text)).toEqual(["alice note"]);

    const bobView = events.listEventsBetween(bob.id, "2026-08-20", "2026-08-20", TZ, db);
    expect(bobView.map((e: { raw_text: string }) => e.raw_text)).toEqual(["bob note"]);
  });
});
