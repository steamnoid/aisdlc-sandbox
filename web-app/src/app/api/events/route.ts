import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "../../../lib/auth.js";
import { createEvent, listEvents, listEventsBetween } from "../../../lib/events.js";
import { getDb } from "../../../lib/db.js";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const userId = token ? await verifySession(token) : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { text?: unknown; timezone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const event = createEvent(userId, String(body.text ?? ""), body.timezone == null ? null : String(body.timezone), getDb());
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const userId = token ? await verifySession(token) : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const tz = searchParams.get("tz");
  try {
    if (from !== null || to !== null || tz !== null) {
      if (!from || !to || !tz) {
        return NextResponse.json(
          { error: "from, to and tz must be provided together" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { events: listEventsBetween(userId, from, to, tz, getDb()) },
        { status: 200 }
      );
    }
    return NextResponse.json({ events: listEvents(userId, getDb()) }, { status: 200 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
