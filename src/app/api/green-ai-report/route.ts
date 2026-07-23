import { NextResponse } from "next/server";
import { getGreenAiReport } from "@/services/greenAiEngine";
import { getApiAccess } from "@/services/authService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getApiAccess("greenAiReport", "/api/green-ai-report");
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });
    const report = await getGreenAiReport();
    if (access.context?.plan?.code === "PRO") {
      return NextResponse.json({
        predictions: report.predictions.slice(0, 10),
        trainingRecords: report.trainingRecords,
        methodology: report.methodology,
        generatedAt: report.generatedAt,
        plan: "PRO",
        limited: true,
      });
    }
    return NextResponse.json({ ...report, plan: access.context?.plan?.code });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no relatorio AI" }, { status: 503 });
  }
}
