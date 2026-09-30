import { NextRequest, NextResponse } from "next/server";
import { registerUser, createSession, buildSetCookie } from "../../../../lib/auth.js";
import { getDb } from "../../../../lib/db.js";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const user = registerUser(String(body.email ?? ""), String(body.password ?? ""), getDb());
    const response = NextResponse.json({ id: user.id, email: user.email, created_at: user.created_at }, { status: 201 });
    response.headers.append("Set-Cookie", buildSetCookie(await createSession(user.id, user.email)));
    return response;
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
