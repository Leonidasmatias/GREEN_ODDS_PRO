import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProviderUsageBudget } from "@/services/providerEconomyService";
import { syncOddsAndTips } from "@/services/syncService";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse("Autenticacao necessaria.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GREEN ODDS PRO Admin", charset="UTF-8"' },
  });
}

function isAdmin(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!username || !password) return false;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;
  const [providedUser, providedPassword] = atob(authorization.slice(6)).split(":");
  return providedUser === username && providedPassword === password;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !isAdmin(request)) return unauthorized();
  const before = await getProviderUsageBudget("the-odds-api");
  if (before.callsRemainingToday <= 0) {
    return NextResponse.json({
      ok: false,
      status: "PROVIDER_DAILY_LIMIT_REACHED",
      warning: "Limite diário do provider atingido. Próxima sincronização disponível amanhã.",
      callsUsed: before.callsToday,
      callsRemainingToday: before.callsRemainingToday,
      nextAllowedSyncAt: before.nextAllowedSyncAt,
    }, { status: 429 });
  }
  if (before.hourlyCallsRemaining < 2) {
    return NextResponse.json({
      ok: false,
      status: "PROVIDER_HOURLY_LIMIT_REACHED",
      warning: "Limite horário do provider atingido. Próxima sincronização disponível em breve.",
      callsUsed: before.callsToday,
      callsRemainingToday: before.callsRemainingToday,
      nextAllowedSyncAt: before.nextAllowedSyncAt,
    }, { status: 429 });
  }

  await prisma.providerCache.deleteMany({ where: { provider: "the-odds-api" } }).catch(() => undefined);
  const result = await syncOddsAndTips();
  const after = await getProviderUsageBudget("the-odds-api");
  return NextResponse.json({
    ...result,
    callsUsed: Math.max(0, after.callsToday - before.callsToday),
    callsToday: after.callsToday,
    callsRemainingToday: after.callsRemainingToday,
    creditsRemaining: after.creditsRemaining ?? result.requestsRemaining ?? null,
    nextAllowedSyncAt: after.nextAllowedSyncAt,
  }, { status: result.ok ? 200 : 503 });
}
