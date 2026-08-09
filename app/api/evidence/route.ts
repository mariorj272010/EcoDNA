import { NextRequest, NextResponse } from "next/server";
import { canReview, getAuthSession } from "@/lib/server/auth";

export const runtime = "nodejs";

const bucket = "ecodna-evidence";
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function storageHeaders(contentType?: string): HeadersInit {
  const legacyJwt = serviceKey?.startsWith("eyJ");
  return { apikey: serviceKey || "", ...(legacyJwt ? { Authorization: `Bearer ${serviceKey}` } : {}), ...(contentType ? { "Content-Type": contentType } : {}) };
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Supabase evidence storage is not configured." }, { status: 503 });
  const session = await getAuthSession(request);
  if (!session) return NextResponse.json({ error: "Sign in as a reporter before uploading evidence." }, { status: 401 });
  if (session.role !== "reporter") return NextResponse.json({ error: "Reviewer accounts cannot upload reporter evidence." }, { status: 403 });
  const form = await request.formData();
  const evidence = form.get("evidence");
  const reportId = String(form.get("reportId") || "report").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 90);
  if (!(evidence instanceof File) || evidence.type !== "image/jpeg") return NextResponse.json({ error: "A compressed JPEG evidence image is required." }, { status: 400 });
  if (evidence.size > 1024 * 1024) return NextResponse.json({ error: "Evidence image must be smaller than 1 MB." }, { status: 400 });

  const month = new Date().toISOString().slice(0, 7);
  const path = `observations/${month}/${reportId}-${crypto.randomUUID()}.jpg`;
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { ...storageHeaders("image/jpeg"), "x-upsert": "false" }, body: Buffer.from(await evidence.arrayBuffer()) });
  if (!upload.ok) return NextResponse.json({ error: `Evidence upload failed (${upload.status}): ${(await upload.text()).slice(0, 180)}` }, { status: 502 });
  return NextResponse.json({ path });
}

export async function GET(request: NextRequest) {
  if (!canReview(await getAuthSession(request))) return NextResponse.json({ error: "Reviewer permission required." }, { status: 403 });
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Supabase evidence storage is not configured." }, { status: 503 });
  const path = request.nextUrl.searchParams.get("path") || "";
  if (!/^observations\/[0-9]{4}-[0-9]{2}\/[a-zA-Z0-9_-]+\.jpg$/.test(path)) return NextResponse.json({ error: "Invalid evidence path." }, { status: 400 });
  const download = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${path}`, { cache: "no-store", headers: storageHeaders() });
  if (!download.ok) return NextResponse.json({ error: `Evidence could not be loaded (${download.status}).` }, { status: download.status });
  return new NextResponse(await download.arrayBuffer(), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" } });
}
