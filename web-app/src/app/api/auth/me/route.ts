import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionPayload } from "../../../../lib/auth.js";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifySessionPayload(token) : null;
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ id: payload.sub, email: payload.email ?? "" }, { status: 200 });
}
