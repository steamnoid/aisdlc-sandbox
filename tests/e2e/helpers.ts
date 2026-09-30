import { expect, type APIRequestContext, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { DATA_DB } from "./infra/env";

export const TEST_PASSWORD = "password123";

export function uniqueEmail(tag: string): string {
  return `qa-${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e2e.test`;
}

export async function apiRegister(request: APIRequestContext, email: string, password = TEST_PASSWORD): Promise<void> {
  const res = await request.post("/api/auth/register", { data: { email, password } });
  if (!res.ok()) throw new Error(`register failed (${res.status()}): ${await res.text()}`);
}

export async function apiLogout(request: APIRequestContext): Promise<void> {
  const res = await request.post("/api/auth/logout");
  if (!res.ok()) throw new Error(`logout failed (${res.status()}): ${await res.text()}`);
}

export async function apiCreateEvent(request: APIRequestContext, rawText: string): Promise<void> {
  const res = await request.post("/api/events", { data: { text: rawText } });
  if (!res.ok()) throw new Error(`event create failed (${res.status()}): ${await res.text()}`);
}

type EventRow = { id: string; raw_text: string };

function unwrapEvents(body: unknown): EventRow[] {
  if (Array.isArray(body)) return body as EventRow[];
  if (body && typeof body === "object") {
    for (const key of ["events", "items", "data"]) {
      const value = (body as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as EventRow[];
    }
  }
  throw new Error(`unexpected GET /api/events response shape: ${JSON.stringify(body).slice(0, 200)}`);
}

export async function apiListEvents(request: APIRequestContext): Promise<EventRow[]> {
  const res = await request.get("/api/events");
  if (!res.ok()) throw new Error(`list events failed (${res.status()}): ${await res.text()}`);
  return unwrapEvents(await res.json());
}

export async function findOwnEventId(request: APIRequestContext, rawText: string): Promise<string> {
  const matches = (await apiListEvents(request)).filter((e) => e.raw_text === rawText);
  if (matches.length !== 1) throw new Error(`expected exactly one event "${rawText}", found ${matches.length}`);
  return matches[0].id;
}

export function setEventTimestamp(eventId: string, isoUtc: string): void {
  const db = new Database(DATA_DB);
  try {
    db.prepare("UPDATE events SET created_at = ? WHERE id = ?").run(isoUtc, eventId);
  } finally {
    db.close();
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function localNoonIso(dayOffset: number): string {
  const d = addDays(new Date(), dayOffset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function openTimeline(page: Page): Promise<unknown> {
  return page.goto("/");
}

export async function waitTimelineLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId("timeline-event").first()).toBeVisible();
}

export function eventCard(page: Page, snippet: string) {
  return page.getByTestId("timeline-event").filter({ hasText: snippet });
}

export async function timelineTexts(page: Page): Promise<string[]> {
  await page.getByTestId("timeline-event").first().waitFor();
  return page.getByTestId("timeline-event").allTextContents();
}

export function confirmDialog(page: Page) {
  return page.getByTestId("delete-confirm-dialog");
}

export function trackDeleteRequests(page: Page): () => number {
  let count = 0;
  page.on("request", (req) => {
    if (req.method() === "DELETE" && new URL(req.url()).pathname.startsWith("/api/events/")) count += 1;
  });
  return () => count;
}

export async function loginViaForm(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const submit = page.locator('button[type="submit"]').first();
  await submit.click();
}

export async function deleteViaUi(page: Page, snippet: string): Promise<void> {
  await eventCard(page, snippet).getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);
}
