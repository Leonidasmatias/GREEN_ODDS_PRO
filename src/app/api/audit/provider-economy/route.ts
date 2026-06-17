import { NextResponse } from "next/server";
import { getProviderEconomyAudit } from "@/services/providerEconomyService";

export const dynamic = "force-dynamic";

export async function GET() {
  console.log("[provider-economy] request received");
  const audit = await getProviderEconomyAudit();
  console.log(`[provider-economy] returning 200 economyMode=${audit.economyMode} callsToday=${audit.callsToday}`);
  return NextResponse.json(audit);
}
