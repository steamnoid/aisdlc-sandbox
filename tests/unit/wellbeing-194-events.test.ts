import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../web-app/src/lib/db.js";
import * as auth from "../../web-app/src/lib/auth.js";
import * as events from "../../web-app/src/lib/events.js";

describe("WELLBEINGT-195 event deletion API — approved Product AC", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  function newUser(email: string) {
    return auth.registerUser(email, "password123", db);
  }

  it("AC-5 deleting an own event removes it permanently", () => {
    const user = newUser("delete-permanent@example.com");
    const kept = events.createEvent(user.id, "stays here", null, db);
    const removed = events.createEvent(user.id, "to be deleted", null, db);

    const result = events.deleteEvent(user.id, removed.id, db);

    expect(result.status).toBe("deleted");
    expect(events.listEvents(user.id, db).map((e: { id: string }) => e.id)).toEqual([kept.id]);
    expect(
      events.deleteEvent(user.id, removed.id, db)
    );
    expect(events.listEvents(user.id, db)).toHaveLength(1);
  });

  it("AC-6 a foreign account's event is refused and left untouched", () => {
    const alice = newUser("alice-delete@example.com");
    const bob = newUser("bob-delete@example.com");
    const bobsEvent = events.createEvent(bob.id, "bob private", null, db);

    expect(() => events.deleteEvent(alice.id, bobsEvent.id, db)).toThrow(
      /Not found/
    );
    try {
      events.deleteEvent(alice.id, bobsEvent.id, db);
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
    expect(
      events.listEvents(bob.id, db).map((e: { id: string }) => e.raw_text)
    ).toEqual(["bob private"]);
  });

  it("AC-10 repeating a finished deletion completes as already-deleted without failing", () => {
    const user = newUser("repeat@example.com");
    const event = events.createEvent(user.id, "once", null, db);

    expect(events.deleteEvent(user.id, event.id, db).status).toBe("deleted");
    expect(events.deleteEvent(user.id, event.id, db).status).toBe("already_deleted");

    const other = "00000000-0000-0000-0000-000000000000";
    expect(events.deleteEvent(user.id, other, db).status).toBe("already_deleted");
  });

  it("a missing or empty eventId is rejected with status 400", () => {
    const user = newUser("validate-delete@example.com");
    expect(() => events.deleteEvent(user.id, "", db)).toThrow(/eventId is required/);
    try {
      events.deleteEvent(user.id, "", db);
    } catch (err) {
      expect((err as { status?: number }).status).toBe(400);
    }
  });
});
