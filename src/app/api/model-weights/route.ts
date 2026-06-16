import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultModelWeights, type ModelWeights } from "@/lib/backtestEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const weights = await prisma.modelWeights.upsert({ where: { id: "default" }, update: {}, create: { id: "default", ...defaultModelWeights } });
    return NextResponse.json(weights);
  } catch {
    return NextResponse.json(defaultModelWeights);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as Partial<ModelWeights>;
    const values = Object.fromEntries(Object.entries(defaultModelWeights).map(([key, fallback]) => [key, Math.max(0, Math.min(100, Number(payload[key as keyof ModelWeights] ?? fallback)))])) as unknown as ModelWeights;
    const weights = await prisma.modelWeights.upsert({ where: { id: "default" }, update: values, create: { id: "default", ...values } });
    return NextResponse.json({ ok: true, weights });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao salvar pesos" }, { status: 503 });
  }
}
