import { NextResponse } from "next/server";
import { importResultsAndSettle } from "@/services/resultImportService";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...(await importResultsAndSettle()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha na liquidação" }, { status: 503 });
  }
}
