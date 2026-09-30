import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../web-app/src/lib/db.js";
import * as auth from "../../web-app/src/lib/auth.js";
import * as events from "../../web-app/src/lib/events.js";

type AnyError = { status?: number; message?: string } | null;

function errorOf(fn: () => unknown): AnyError {
  try {
    fn();
    return null;
  } catch (err) {
    return err as AnyError;
  }
}

describe("WELLBEINGT-177 Multiple User Support — approved Product AC", () => {
  let db: ReturnType<typeof getTestDb>;
  beforeEach(() => {
    db = getTestDb();
  });

  it("AC-1 signing up creates an account and logs the new user in", async () => {
    const user = auth.registerUser("new@example.com", "password123", db);
    expect(user.email).toBe("new@example.com");
    expect(user.id).toBeTruthy();
    const token = await auth.createSession(user.id);
    expect(await auth.verifySession(token)).toBe(user.id);
  });

  it("AC-5 signing up with an already used email is rejected without creating a duplicate", () => {
    auth.registerUser("dup@example.com", "password123", db);
    const err = errorOf(() => auth.registerUser("dup@example.com", "password123", db));
    expect(err?.message).toBe("Email already used");
    const count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = ?").get("dup@example.com");
    expect(count.n).toBe(1);
  });

  it("AC-2 logging in with correct credentials authenticates the user", async () => {
    auth.registerUser("login@example.com", "password123", db);
    const user = auth.authenticateUser("login@example.com", "password123", db);
    expect(user.email).toBe("login@example.com");
    const token = await auth.createSession(user.id);
    expect(await auth.verifySession(token)).toBe(user.id);
  });

  it("AC-3 login with incorrect password is rejected and does not log anyone in", () => {
    auth.registerUser("guard@example.com", "password123", db);
    expect(errorOf(() => auth.authenticateUser("guard@example.com", "wrong-pass", db))?.message).toBe(
      "Invalid email or password"
    );
    expect(errorOf(() => auth.authenticateUser("unknown@example.com", "password123", db))?.message).toBe(
      "Invalid email or password"
    );
  });

  it("signup validation: malformed email or short password is rejected with 400", () => {
    expect(errorOf(() => auth.registerUser("not-an-email", "password123", db))?.status).toBe(400);
    expect(errorOf(() => auth.registerUser("ok@example.com", "short", db))?.status).toBe(400);
  });

  it("AC-6 a valid session survives verification while garbage tokens yield no user", async () => {
    const user = auth.registerUser("session@example.com", "password123", db);
    const token = await auth.createSession(user.id);
    expect(await auth.verifySession(token)).toBe(user.id);
    expect(await auth.verifySession("garbage-token")).toBeNull();
    expect(auth.buildClearCookie()).toContain("Max-Age=0");
  });
});

describe("WELLBEINGT-176 Event entry support — approved Product AC", () => {
  let db: ReturnType<typeof getTestDb>;
  beforeEach(() => {
    db = getTestDb();
  });

  function newUser(email: string) {
    return auth.registerUser(email, "password123", db);
  }

  it("AC-1 whitespace-only submission is rejected and creates no event", () => {
    const user = newUser("empty@example.com");
    expect(() => events.createEvent(user.id, "   ", null, db)).toThrow();
    expect(events.listEvents(user.id, db)).toHaveLength(0);
  });

  it("AC-2 an event mentioning no date gets the current moment as its timestamp", () => {
    const user = newUser("stamp@example.com");
    const before = Date.now() - 2000;
    const event = events.createEvent(user.id, "Evening walk felt great", null, db);
    const stamped = Date.parse(event.created_at);
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now() + 1000);
    expect(event.timezone).toBe("UTC");
  });

  it("AC-3 events are visible only to the user who entered them", () => {
    const author = newUser("author@example.com");
    const outsider = newUser("outsider@example.com");
    events.createEvent(author.id, "private note", null, db);
    expect(events.listEvents(outsider.id, db)).toHaveLength(0);
    expect(events.listEvents(author.id, db).map((e) => e.raw_text)).toEqual(["private note"]);
  });

  it("AC-4 entered events persist after logging out and back in", () => {
    const user = newUser("persist@example.com");
    events.createEvent(user.id, "still here", null, db);
    const returning = auth.authenticateUser("persist@example.com", "password123", db);
    expect(events.listEvents(returning.id, db).map((e) => e.raw_text)).toEqual(["still here"]);
  });

  it("AC-5 timeline lists most recent entries first", () => {
    const user = newUser("order@example.com");
    events.createEvent(user.id, "first", null, db);
    const past = new Date(Date.now() - 60_000).toISOString();
    db.prepare("UPDATE events SET created_at = ? WHERE raw_text = ?").run(past, "first");
    events.createEvent(user.id, "second", null, db);
    const texts = events.listEvents(user.id, db).map((e) => e.raw_text);
    expect(texts).toEqual(["second", "first"]);
  });

  it("free text is stored exactly as typed, including time wording", () => {
    const user = newUser("verbatim@example.com");
    const event = events.createEvent(user.id, "went for a run at 6:30", null, db);
    expect(event.raw_text).toBe("went for a run at 6:30");
    expect(events.listEvents(user.id, db)[0].raw_text).toBe("went for a run at 6:30");
  });

  it("text over 1000 characters is rejected", () => {
    const user = newUser("long@example.com");
    expect(() => events.createEvent(user.id, "a".repeat(1001), null, db)).toThrow(/Max 1000 characters/);
    expect(events.listEvents(user.id, db)).toHaveLength(0);
  });
});
