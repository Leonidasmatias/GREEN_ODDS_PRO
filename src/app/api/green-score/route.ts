import { NextResponse } from "next/server";
import { buildGreenScoreReport } from "@/services/greenScoreEngine";
import { getApiAccess } from "@/services/authService";
import { limitItemsByPlan } from "@/services/subscriptionAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getApiAccess("dashboard", "/api/green-score");
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });
    const report = await buildGreenScoreReport();
    return NextResponse.json({ ...report, oddsOfDay: limitItemsByPlan(report.oddsOfDay, access.context?.plan?.code), radar: limitItemsByPlan(report.radar, access.context?.plan?.code), plan: access.context?.plan?.code });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no Green Score Engine" }, { status: 503 }); }
}
