import { NextResponse } from "next/server";
import { getCommandCenter } from "@/services/operationalService";
import { getApiAccess } from "@/services/authService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("[command-center] request received");
    const access = await getApiAccess("commandCenter", "/api/command-center");
    if (!access.allowed) {
      console.log(`[command-center] access denied reason=${access.reason}`);
      return NextResponse.json({ error: access.reason }, { status: access.status });
    }
    const payload = await getCommandCenter();
    console.log(`[command-center] returning 200 provider=${payload.operational.provider} providerStatus=${payload.operational.providerStatus}`);
    return NextResponse.json(payload);
  }
  catch (error) {
    console.log(`[command-center] failed error=${error instanceof Error ? error.message : "unknown"}`);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no command center" }, { status: 503 });
  }
}
