import { NextResponse } from "next/server";
import { getPerformance } from "@/services/operationalService";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await getPerformance()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao calcular performance" }, { status: 503 }); }
}
