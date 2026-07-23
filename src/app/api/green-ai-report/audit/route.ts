import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildGreenScoreReport } from "@/services/greenScoreEngine";
import { getApiAccess } from "@/services/authService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getApiAccess("greenAiReport", "/api/green-ai-report/audit");
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });
    const report = await buildGreenScoreReport();
    const latest = await prisma.greenScoreAnalysis.findMany({ orderBy: { analyzedAt: "desc" }, take: 100 });
    return NextResponse.json({
      audit: report.audit,
      criteria: { oddsOfDay: "greenScore >= 80 AND confidence >= 80 AND risk LOW" },
      mockSyntheticCheck: {
        status: report.audit.sourceIntegrity.status,
        onlyRealProvider: report.audit.sourceIntegrity.onlyRealProvider,
        mockProviders: report.audit.sourceIntegrity.mockProviders,
        mockEvents: report.audit.sourceIntegrity.mockEvents,
        syntheticRows: report.audit.sourceIntegrity.syntheticRows,
      },
      persistence: report.audit.persistence,
      latest: latest.map((item) => ({ ...item, analyzedAt: item.analyzedAt.toISOString(), createdAt: item.createdAt.toISOString() })),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na auditoria Green Intelligence" }, { status: 503 });
  }
}
