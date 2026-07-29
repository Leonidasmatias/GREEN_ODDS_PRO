// Sprint 9.0 — Prediction Intelligence Framework, Etapa 6.
// Wrapper fino — ver `src/app/api/predictions/route.ts` para a
// justificativa completa da separação NextRequest/lógica pura. Endpoint
// NOVO (não altera nenhum endpoint existente da Sprint 8.1) — mesmo gate
// de autenticação/autorização (`predictionCenter`) dos demais.
import { NextRequest, NextResponse } from "next/server";
import { getApiAccess } from "@/services/authService";
import { handleGetPredictionExplanation } from "@/services/predictionExplanationApiHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Somente leitura — explicação estruturada (fatores, breakdown de
 * confiança, razões, riscos, qualidade) derivada do snapshot já
 * persistido. Nunca recalcula a previsão. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getApiAccess("predictionCenter", "/api/predictions/[id]/explanation");
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const { id } = await params;
  const { status, body } = await handleGetPredictionExplanation(id);
  return NextResponse.json(body, { status });
}
