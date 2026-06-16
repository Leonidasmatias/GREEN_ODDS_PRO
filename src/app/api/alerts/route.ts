import { NextResponse } from "next/server";
import { getAlerts } from "@/services/operationalService";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json({ alerts: await getAlerts(), refreshedAt: new Date().toISOString() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao gerar alertas" }, { status: 503 }); }
}
