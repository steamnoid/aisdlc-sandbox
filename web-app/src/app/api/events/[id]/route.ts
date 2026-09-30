import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "../../../../lib/auth.js";
import { deleteEvent } from "../../../../lib/events.js";
import { getDb } from "../../../../lib/db.js";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const userId = token ? await verifySession(token) : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    deleteEvent(userId, id, getDb());
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
