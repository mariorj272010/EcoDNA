import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const session = await getAuthSession(request);
  return session ? NextResponse.json({ session }) : NextResponse.json({ session: null }, { status: 401 });
}
