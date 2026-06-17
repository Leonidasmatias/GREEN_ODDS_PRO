import { NextResponse } from "next/server";
import { getProviderEconomyAudit } from "@/services/providerEconomyService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getProviderEconomyAudit());
}
