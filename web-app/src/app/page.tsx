import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySession } from "../lib/auth.js";

export default async function Home() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const userId = token ? await verifySession(token) : null;
  redirect(userId ? "/events/new" : "/login");
}
