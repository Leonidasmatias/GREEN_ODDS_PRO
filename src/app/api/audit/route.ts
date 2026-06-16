import { NextResponse } from "next/server";
import { getAudit } from "@/services/operationalService";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAudit();
  return NextResponse.json(data, { status: "error" in data ? 503 : 200 });
}
