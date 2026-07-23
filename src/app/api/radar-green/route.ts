import { NextResponse } from "next/server";
import { buildGreenScoreReport } from "@/services/greenScoreEngine";
import { getApiAccess } from "@/services/authService";
import { limitItemsByPlan } from "@/services/subscriptionAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getApiAccess("radarGreen", "/api/radar-green");
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });
    const report = await buildGreenScoreReport();
    const opportunities = limitItemsByPlan(report.radar, access.context?.plan?.code);
    return NextResponse.json({ ...report, radar: opportunities, opportunities, plan: access.context?.plan?.code });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no Radar Green" }, { status: 503 });
  }
}
