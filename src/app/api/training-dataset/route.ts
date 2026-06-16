import { NextRequest, NextResponse } from "next/server";
import { buildTrainingDataset, exportTrainingDataset, validateDataset } from "@/services/trainingPipeline";
import { trainModelIfEligible } from "@/services/modelTrainingService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const exported = await exportTrainingDataset(format);
  return new NextResponse(exported.content, { headers: { "Content-Type": exported.contentType, "Content-Disposition": `attachment; filename="${exported.filename}"`, "X-Record-Count": String(exported.records) } });
}

export async function POST() {
  try { const build = await buildTrainingDataset(); return NextResponse.json({ ok: true, build, validation: await validateDataset(), training: await trainModelIfEligible() }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha no pipeline" }, { status: 503 }); }
}
