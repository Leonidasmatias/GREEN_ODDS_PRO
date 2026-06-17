import { NextResponse } from "next/server";
import { getReadinessReport } from "@/services/liveDataService";
export const dynamic="force-dynamic";
export async function GET(){
  console.log("[readiness] request received");
  const report=await getReadinessReport();
  const status=report.status==="RED"?503:200;
  console.log(`[readiness] returning ${status} status=${report.status}`);
  return NextResponse.json(report,{status});
}
