// Sprint 8.1 — Prediction API and Server Actions.
// Wrapper fino — ver `src/app/api/predictions/route.ts` para a
// justificativa completa da separação NextRequest/lógica pura.
import { NextRequest, NextResponse } from "next/server";
import { getApiAccess } from "@/services/authService";
import { handleGetPredictionById } from "@/services/predictionApiHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Somente leitura. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getApiAccess("predictionCenter", "/api/predictions/[id]");
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const { id } = await params;
  const { status, body } = await handleGetPredictionById(id);
  return NextResponse.json(body, { status });
}
