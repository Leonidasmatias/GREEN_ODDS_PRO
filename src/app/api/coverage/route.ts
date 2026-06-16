import { NextResponse } from "next/server";
import { getCoverageAnalytics } from "@/services/productionOperationsService";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await getCoverageAnalytics()); }
