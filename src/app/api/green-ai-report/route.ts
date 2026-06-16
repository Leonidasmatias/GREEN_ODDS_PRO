import { NextResponse } from "next/server";
import { getGreenAiReport } from "@/services/greenAiEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await getGreenAiReport()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no relatório AI" }, { status: 503 }); }
}
