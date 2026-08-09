import { NextRequest, NextResponse } from "next/server";
import { isIntervention } from "@/lib/interventions";
import { readInterventions, upsertIntervention } from "@/lib/server/interventionStore";
import { canReview, getAuthSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try { return NextResponse.json({ interventions: await readInterventions() }); }
  catch (error) { console.error(error); return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load interventions." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    if (!canReview(await getAuthSession(request))) return NextResponse.json({ error: "Reviewer permission required." }, { status: 403 });
    const body: unknown = await request.json();
    const entry = body && typeof body === "object" ? (body as { intervention?: unknown }).intervention : undefined;
    if (!isIntervention(entry)) return NextResponse.json({ error: "Invalid intervention." }, { status: 400 });
    return NextResponse.json({ interventions: await upsertIntervention(entry) });
  } catch (error) { console.error(error); return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save intervention." }, { status: 500 }); }
}
