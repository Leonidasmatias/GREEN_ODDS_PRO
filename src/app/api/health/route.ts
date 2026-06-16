import { NextResponse } from "next/server";
import { getHealthStatus } from "@/services/productionOperationsService";
export const dynamic = "force-dynamic";
export async function GET() { const health = await getHealthStatus(); return NextResponse.json(health, { status: health.status === "RED" ? 503 : 200 }); }
