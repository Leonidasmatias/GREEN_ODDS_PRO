// Sprint 8.1 — Prediction API and Server Actions.
// Wrapper fino — ver `src/app/api/predictions/route.ts` para a
// justificativa completa da separação NextRequest/lógica pura.
import { NextRequest, NextResponse } from "next/server";
import { getApiAccess } from "@/services/authService";
import { handleGetPredictionHistoryByMatch } from "@/services/predictionApiHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Somente leitura — histórico paginado da partida. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const access = await getApiAccess("predictionCenter", "/api/predictions/match/[matchId]");
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const { matchId } = await params;
  const { status, body } = await handleGetPredictionHistoryByMatch(matchId, request.nextUrl.searchParams);
  return NextResponse.json(body, { status });
}
