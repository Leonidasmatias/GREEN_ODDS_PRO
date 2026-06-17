import { NextResponse } from "next/server";
import { getSystemStatus, syncOddsAndTips } from "@/services/syncService";
import { isProviderEconomyMode } from "@/services/providerEconomyService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSystemStatus());
}

export async function POST() {
  if (isProviderEconomyMode()) {
    return NextResponse.json({
      ok: false,
      status: "PROVIDER_ECONOMY_MODE_ACTIVE",
      warning: "Modo econômico ativo. Use POST /api/providers/sync para sincronização manual controlada.",
    }, { status: 409 });
  }
  const result = await syncOddsAndTips();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
