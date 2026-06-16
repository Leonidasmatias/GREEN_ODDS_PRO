import { NextResponse } from "next/server";
import { getModelPerformance } from "@/services/modelTrainingService";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await getModelPerformance()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar performance do modelo" }, { status: 503 }); }
}
