import { NextResponse } from "next/server";
import { buildGreenScoreReport } from "@/services/greenScoreEngine";
import { getApiAccess } from "@/services/authService";
import { limitItemsByPlan } from "@/services/subscriptionAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getApiAccess("oddsDoDia", "/api/odds-do-dia");
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });
    const report = await buildGreenScoreReport();
    const opportunities = limitItemsByPlan(report.oddsOfDay, access.context?.plan?.code);
    return NextResponse.json({ ...report, oddsOfDay: opportunities, opportunities, plan: access.context?.plan?.code, criteria: { greenScore: ">= 80", confidence: ">= 80", risk: "LOW" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha nas Odds do Dia" }, { status: 503 });
  }
}
