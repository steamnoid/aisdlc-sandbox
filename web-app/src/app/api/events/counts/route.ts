import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "../../../../lib/auth.js";
import { countEventsByDay } from "../../../../lib/events.js";
import { getDb } from "../../../../lib/db.js";

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
  if (!from || !to || !tz) {
    return NextResponse.json({ error: "from, to and tz are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      { counts: countEventsByDay(userId, from, to, tz, getDb()) },
      { status: 200 }
    );
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
