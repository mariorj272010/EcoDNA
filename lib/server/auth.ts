import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import type { AuthSession } from "@/lib/types";

export const AUTH_COOKIE = "ecodna_access_token";
export type UserRole = "reporter" | "reviewer";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function serverHeaders(contentType = false): HeadersInit {
  const legacyJwt = serviceKey?.startsWith("eyJ");
  return {
    apikey: serviceKey || "",
    ...(legacyJwt ? { Authorization: `Bearer ${serviceKey}` } : {}),
    ...(contentType ? { "Content-Type": "application/json" } : {})
  };
}

export function authConfigured() { return Boolean(supabaseUrl && serviceKey); }

export function setAuthCookie(response: NextResponse, token: string, expiresIn = 3600) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: expiresIn
  });
}

function usernameFallback(email: string) {
  return email.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) || "ecodna_user";
}

export async function getAuthSession(request: NextRequest): Promise<AuthSession | null> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token || !authConfigured()) return null;
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { cache: "no-store", headers: { apikey: serviceKey || "", Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) return null;
  const user = await userResponse.json() as { id?: string; email?: string };
  if (!user.id || !user.email) return null;

  let role: UserRole = "reporter";
  let username = usernameFallback(user.email);
  let rewardPoints = 0;
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/ecodna_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=role,username,reward_points&limit=1`, { cache: "no-store", headers: serverHeaders() });
  if (profileResponse.ok) {
    const profiles = await profileResponse.json() as Array<{ role?: string; username?: string; reward_points?: number }>;
    if (profiles[0]?.role === "reviewer") role = "reviewer";
    if (profiles[0]?.username) username = profiles[0].username;
    if (Number.isFinite(profiles[0]?.reward_points)) rewardPoints = Number(profiles[0].reward_points);
  } else {
    // Keep pre-rewards installations usable until the updated SQL migration is run.
    const legacyProfile = await fetch(`${supabaseUrl}/rest/v1/ecodna_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, { cache: "no-store", headers: serverHeaders() });
    if (legacyProfile.ok) {
      const profiles = await legacyProfile.json() as Array<{ role?: string }>;
      if (profiles[0]?.role === "reviewer") role = "reviewer";
    }
  }
  return { id: user.id, email: user.email, username, role, rewardPoints };
}

export function canReview(session: AuthSession | null) { return session?.role === "reviewer"; }
