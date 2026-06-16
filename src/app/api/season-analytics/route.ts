import { NextResponse } from "next/server";
import { getSeasonAnalytics } from "@/services/productionOperationsService";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ competitions: await getSeasonAnalytics(), generatedAt: new Date().toISOString() }); }
