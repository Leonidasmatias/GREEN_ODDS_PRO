import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { historicalBacktestData } from "@/data/backtestData";
import { buildBacktestReport } from "@/lib/backtestEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = buildBacktestReport(historicalBacktestData);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.12, 0.62, 0.34);
  const dark = rgb(0.05, 0.08, 0.06);
  const gray = rgb(0.35, 0.39, 0.36);
  let y = 790;
  page.drawRectangle({ x: 0, y: 742, width: 595.28, height: 100, color: dark });
  page.drawText("GREEN ODDS PRO", { x: 46, y, size: 22, font: bold, color: green });
  page.drawText("Green Lab - Relatorio Executivo", { x: 46, y: y - 28, size: 15, font: bold, color: rgb(1,1,1) });
  page.drawText(`Data: ${new Date().toLocaleDateString("pt-BR")}`, { x: 46, y: y - 48, size: 9, font: regular, color: rgb(0.72,0.75,0.73) });
  y = 700;
  page.drawText("Resumo do backtest", { x: 46, y, size: 16, font: bold, color: dark });
  const metrics = [
    ["ROI sobre banca", `${report.metrics.roi.toFixed(2)}%`], ["Yield", `${report.metrics.yield.toFixed(2)}%`], ["Win Rate", `${report.metrics.winRate.toFixed(2)}%`], ["Lucro acumulado", `${report.metrics.accumulatedProfit.toFixed(2)}u`], ["Drawdown maximo", `${report.metrics.maxDrawdown.toFixed(2)}u`], ["Entradas", report.metrics.entries.toString()],
  ];
  metrics.forEach(([label,value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 46 + column * 170;
    const boxY = y - 68 - row * 72;
    page.drawRectangle({ x, y: boxY, width: 150, height: 55, color: rgb(0.95,0.97,0.95), borderColor: rgb(0.85,0.88,0.86), borderWidth: 1 });
    page.drawText(label, { x: x + 10, y: boxY + 35, size: 8, font: regular, color: gray });
    page.drawText(value, { x: x + 10, y: boxY + 13, size: 15, font: bold, color: value.startsWith("-") ? rgb(0.8,0.18,0.2) : green });
  });
  y = 505;
  page.drawText("Ranking de mercados", { x: 46, y, size: 16, font: bold, color: dark });
  page.drawRectangle({ x: 46, y: y - 32, width: 500, height: 24, color: dark });
  [["Mercado", 56], ["Yield", 280], ["Win Rate", 375], ["Lucro", 470]].forEach(([label,x]) => page.drawText(String(label), { x: Number(x), y: y - 24, size: 8, font: bold, color: rgb(1,1,1) }));
  report.marketRankings.forEach((market, index) => {
    const rowY = y - 56 - index * 35;
    if (index % 2 === 0) page.drawRectangle({ x: 46, y: rowY - 8, width: 500, height: 30, color: rgb(0.96,0.97,0.96) });
    page.drawText(market.market, { x: 56, y: rowY, size: 9, font: bold, color: dark });
    page.drawText(`${market.yield.toFixed(2)}%`, { x: 280, y: rowY, size: 9, font: regular, color: market.yield >= 0 ? green : rgb(0.8,0.18,0.2) });
    page.drawText(`${market.winRate.toFixed(2)}%`, { x: 375, y: rowY, size: 9, font: regular, color: dark });
    page.drawText(`${market.accumulatedProfit.toFixed(2)}u`, { x: 470, y: rowY, size: 9, font: regular, color: dark });
  });
  page.drawText("Nota: backtest demonstrativo com dados sinteticos e deterministas. Nao representa validacao historica licenciada.", { x: 46, y: 80, size: 8, font: regular, color: gray, maxWidth: 500 });
  page.drawText(`Melhor mercado: ${report.bestMarket?.market ?? "N/A"} | Menor desempenho: ${report.worstMarket?.market ?? "N/A"}`, { x: 46, y: 58, size: 9, font: bold, color: dark });
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="green-lab-relatorio-${new Date().toISOString().slice(0,10)}.pdf"` } });
}
