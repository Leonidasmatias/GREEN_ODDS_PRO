import { NextResponse } from "next/server";
import { getReadinessReport } from "@/services/liveDataService";
export const dynamic="force-dynamic";
export async function GET(){const report=await getReadinessReport();return NextResponse.json(report,{status:report.status==="RED"?503:200});}
