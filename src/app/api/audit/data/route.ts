import { NextResponse } from "next/server";
import { getDataAudit } from "@/services/productionCertificationService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDataAudit());
}
