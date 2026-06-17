import { NextResponse } from "next/server";
import { getProvidersStatus } from "@/providers/providerManager";

export const dynamic = "force-dynamic";

export async function GET() {
  console.log("[providers-status] request received");
  const status = await getProvidersStatus();
  console.log(`[providers-status] returning 200 activeProvider=${status.activeProvider} economyMode=${status.economyMode}`);
  return NextResponse.json(status);
}
