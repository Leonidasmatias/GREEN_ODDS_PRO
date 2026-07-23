import { NextResponse } from "next/server";
import { getPerformance } from "@/services/operationalService";
import { getApiAccess } from "@/services/authService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getApiAccess("performanceCenter", "/api/performance");
    if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });
    return NextResponse.json(await getPerformance());
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao calcular performance" }, { status: 503 }); }
}
