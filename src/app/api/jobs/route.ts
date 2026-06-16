import { NextResponse } from "next/server";
import { getJobMonitor } from "@/services/schedulerService";
export const dynamic = "force-dynamic";
export async function GET() { try { return NextResponse.json(await getJobMonitor()); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no monitor" }, { status: 503 }); } }
