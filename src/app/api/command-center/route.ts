import { NextResponse } from "next/server";
import { getCommandCenter } from "@/services/operationalService";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await getCommandCenter()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no command center" }, { status: 503 }); }
}
