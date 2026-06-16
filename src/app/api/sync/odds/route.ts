import { NextResponse } from "next/server";
import { getSystemStatus, syncOddsAndTips } from "@/services/syncService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSystemStatus());
}

export async function POST() {
  const result = await syncOddsAndTips();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
