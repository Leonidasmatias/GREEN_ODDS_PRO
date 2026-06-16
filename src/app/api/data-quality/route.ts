import { NextResponse } from "next/server";
import { runDataQualityChecks } from "@/services/dataQualityService";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await runDataQualityChecks()); }
