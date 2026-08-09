import { NextRequest, NextResponse } from "next/server";
import { isWasteReport } from "@/lib/storage";
import {
  clearReports,
  readReports,
  replaceReports,
  reportStorageBackend,
  saveReport
} from "@/lib/server/reportStore";
import { canReview, getAuthSession } from "@/lib/server/auth";
import { syncApprovedReportRewards } from "@/lib/server/rewardStore";
import type { WasteReport } from "@/lib/types";

export const runtime = "nodejs";

function hideReporterIdentity(report: WasteReport): WasteReport {
  const { reporterId: _reporterId, reporterUsername: _reporterUsername, ...visible } = report;
  return visible;
}

async function response(request: NextRequest, reports: Awaited<ReturnType<typeof readReports>>) {
  const session = await getAuthSession(request);
  const visibleReports = canReview(session)
    ? reports
    : reports.map(report => report.reporterId === session?.id ? report : hideReporterIdentity(report));
  return NextResponse.json({ reports: visibleReports, storage: reportStorageBackend() });
}

function errorResponse(message: string, error: unknown) {
  console.error(message, error);
  const details = error instanceof Error ? error.message : message;
  return NextResponse.json({ error: details }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    return response(request, await readReports());
  } catch (error) {
    return errorResponse("Could not read the observation store.", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session) return NextResponse.json({ error: "Sign in as a reporter before submitting an observation." }, { status: 401 });
    if (session.role !== "reporter") return NextResponse.json({ error: "Reviewer accounts validate reports; use a reporter account to submit observations." }, { status: 403 });
    const body: unknown = await request.json();
    const report = body && typeof body === "object" ? (body as { report?: unknown }).report : undefined;
    if (!isWasteReport(report)) return NextResponse.json({ error: "Invalid confirmed observation." }, { status: 400 });
    const ownedReport: WasteReport = {
      ...report,
      source: "field",
      reporterId: session.id,
      reporterUsername: session.username,
      reviewStatus: undefined,
      reviewedAt: undefined,
      reviewHistory: undefined
    };
    return response(request, await saveReport(ownedReport));
  } catch (error) {
    return errorResponse("Could not save the confirmed observation.", error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!canReview(session)) return NextResponse.json({ error: "Reviewer permission required." }, { status: 403 });
    const body: unknown = await request.json();
    const reports = body && typeof body === "object" ? (body as { reports?: unknown }).reports : undefined;
    if (!Array.isArray(reports) || !reports.every(isWasteReport)) {
      return NextResponse.json({ error: "Invalid observation data." }, { status: 400 });
    }
    const previous = await readReports();
    const ownership = new Map(previous.map(report => [report.id, { reporterId: report.reporterId, reporterUsername: report.reporterUsername }]));
    const protectedReports = reports.map(report => {
      const original = ownership.get(report.id);
      return original ? { ...report, ...original } : report;
    });
    const saved = await replaceReports(protectedReports);
    await syncApprovedReportRewards(saved);
    return response(request, saved);
  } catch (error) {
    return errorResponse("Could not replace the observation store.", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!canReview(await getAuthSession(request))) return NextResponse.json({ error: "Reviewer permission required." }, { status: 403 });
    return response(request, await clearReports());
  } catch (error) {
    return errorResponse("Could not reset the observation store.", error);
  }
}
