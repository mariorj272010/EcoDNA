import { NextRequest, NextResponse } from "next/server";
import { authConfigured, setAuthCookie } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!authConfigured()) return NextResponse.json({ error: "Supabase authentication is not configured." }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);
  const email = body && typeof body === "object" ? String((body as { email?: unknown }).email || "").trim() : "";
  const password = body && typeof body === "object" ? String((body as { password?: unknown }).password || "") : "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  const url = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const payload = await authResponse.json() as { access_token?: string; expires_in?: number; user?: { email?: string }; error_description?: string; msg?: string };
    if (!authResponse.ok || !payload.access_token) return NextResponse.json({ error: payload.error_description || payload.msg || "Invalid email or password." }, { status: 401 });
    const response = NextResponse.json({ ok: true, email: payload.user?.email || email });
    setAuthCookie(response, payload.access_token, payload.expires_in);
    return response;
  } catch (error) {
    console.error("Supabase sign-in request failed.", error);
    return NextResponse.json({ error: "Could not reach Supabase authentication. Check the server connection and try again." }, { status: 502 });
  }
}
