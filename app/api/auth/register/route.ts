import { NextRequest, NextResponse } from "next/server";
import { authConfigured, serverHeaders, setAuthCookie } from "@/lib/server/auth";

export const runtime = "nodejs";

type RemotePayload = {
  id?: string;
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

function remoteMessage(payload: RemotePayload, fallback: string) {
  return payload.error_description || payload.msg || payload.message || payload.error || fallback;
}

export async function POST(request: NextRequest) {
  if (!authConfigured()) return NextResponse.json({ error: "Supabase authentication is not configured." }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);
  const username = body && typeof body === "object" ? String((body as { username?: unknown }).username || "").trim().toLowerCase() : "";
  const email = body && typeof body === "object" ? String((body as { email?: unknown }).email || "").trim().toLowerCase() : "";
  const password = body && typeof body === "object" ? String((body as { password?: unknown }).password || "") : "";

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return NextResponse.json({ error: "Username must be 3-24 characters using lowercase letters, numbers, or underscores." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });

  const url = process.env.SUPABASE_URL!.replace(/\/$/, "");
  try {
    const usernameResponse = await fetch(`${url}/rest/v1/ecodna_profiles?username=eq.${encodeURIComponent(username)}&select=user_id&limit=1`, { cache: "no-store", headers: serverHeaders() });
    if (!usernameResponse.ok) {
      return NextResponse.json({ error: "Reporter registration needs the updated EcoDNA Supabase SQL. Run supabase/ecodna_reports.sql, then try again." }, { status: 503 });
    }
    const matches = await usernameResponse.json() as unknown[];
    if (matches.length) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });

    const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: serverHeaders(true),
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username } })
    });
    const created = await createResponse.json() as RemotePayload;
    if (!createResponse.ok || !created.id) {
      return NextResponse.json({ error: remoteMessage(created, "Could not create the account.") }, { status: createResponse.status === 422 ? 409 : 400 });
    }

    const profileResponse = await fetch(`${url}/rest/v1/ecodna_profiles`, {
      method: "POST",
      headers: { ...serverHeaders(true), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: created.id, username, role: "reporter" })
    });
    if (!profileResponse.ok) {
      await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(created.id)}`, { method: "DELETE", headers: serverHeaders() });
      return NextResponse.json({ error: "Could not create the EcoDNA reporter profile. Confirm the updated Supabase SQL has been run." }, { status: 503 });
    }

    const signInResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const signIn = await signInResponse.json() as RemotePayload;
    if (!signInResponse.ok || !signIn.access_token) {
      return NextResponse.json({ ok: true, needsSignIn: true, message: "Account created. Sign in to continue." }, { status: 201 });
    }
    const response = NextResponse.json({ ok: true }, { status: 201 });
    setAuthCookie(response, signIn.access_token, signIn.expires_in);
    return response;
  } catch (error) {
    console.error("Supabase registration request failed.", error);
    return NextResponse.json({ error: "Could not reach Supabase authentication. Check the server connection and try again." }, { status: 502 });
  }
}
