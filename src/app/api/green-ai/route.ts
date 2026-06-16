import { NextResponse } from "next/server";
import { predictGreenAi } from "@/services/greenAiEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await predictGreenAi()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no Green AI" }, { status: 503 }); }
}
