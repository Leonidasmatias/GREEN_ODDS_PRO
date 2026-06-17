import { NextResponse } from "next/server";
import { getProvidersStatus } from "@/providers/providerManager";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getProvidersStatus());
}
