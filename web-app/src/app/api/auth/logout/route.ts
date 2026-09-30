import { NextResponse } from "next/server";
import { buildClearCookie } from "../../../../lib/auth.js";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.headers.append("Set-Cookie", buildClearCookie());
  return response;
}
