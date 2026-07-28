// Sprint 8.1 — Prediction API and Server Actions.
// Wrapper fino: só adapta NextRequest/NextResponse e faz a checagem de
// autenticação/autorização (dependem de `next/headers`, por isso vivem
// aqui, nunca em `predictionApiHandlers.ts`). Toda a lógica de
// validação/negócio/erro-para-status vive em `predictionApiHandlers.ts`
// (puro, testável por `node --test`). Nunca importa Repository/Prisma
// diretamente.
import { NextRequest, NextResponse } from "next/server";
import { getApiAccess } from "@/services/authService";
import { handleGeneratePrediction, handleListPredictions } from "@/services/predictionApiHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROUTE = "/api/predictions";

/** Somente leitura — nunca chama o Prediction Engine, nunca chama o
 * Persistence Service. */
export async function GET(request: NextRequest) {
  const access = await getApiAccess("predictionCenter", ROUTE);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const { status, body } = await handleListPredictions(request.nextUrl.searchParams);
  return NextResponse.json(body, { status });
}

/** Geração + persistência explícita — mesma permissão do GET (não há
 * nível operacional distinto de PREMIUM neste sistema; `role` é inerte
 * em todo o access-control, confirmado em auditorias anteriores). */
export async function POST(request: NextRequest) {
  const access = await getApiAccess("predictionCenter", ROUTE);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const { status, body } = await handleGeneratePrediction(rawBody);
  return NextResponse.json(body, { status });
}
