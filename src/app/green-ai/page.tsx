import Link from "next/link";
import { BrainCircuit, Download, FileJson, Gauge, ShieldCheck } from "lucide-react";
import { predictGreenAi } from "@/services/greenAiEngine";

export const dynamic = "force-dynamic";

function tone(classification: string) {
  if (classification === "ELITE GREEN") return "text-neon bg-neon/10";
  if (classification === "PREMIUM") return "text-gold bg-gold/10";
  if (classification === "EVITAR") return "text-red-400 bg-red-400/10";
  return "text-white bg-white/5";
}

export default async function GreenAiPage() {
  const data = await predictGreenAi();
  const averageAiScore = data.predictions.length ? data.predictions.reduce((sum, item) => sum + item.aiScore, 0) / data.predictions.length : 0;
  const averageConfidence = data.predictions.length ? data.predictions.reduce((sum, item) => sum + item.modelConfidence, 0) / data.predictions.length : 0;
  return <>
    <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="label mb-2 text-neon">Aprendizado contínuo</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Green AI Engine V1</h1><p className="mt-2 max-w-3xl text-sm text-zinc-500">Previsões probabilísticas calibradas com dados históricos próprios, desempenho por mercado e backtests.</p></div><div className="flex flex-wrap gap-2"><a href="/api/training-dataset?format=csv" className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-[10px] font-black uppercase"><Download size={14}/>CSV</a><a href="/api/training-dataset?format=json" className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-[10px] font-black uppercase"><FileJson size={14}/>JSON</a><Link href="/green-ai-report" className="rounded-xl bg-neon px-4 py-3 text-[10px] font-black uppercase text-black">Relatório executivo</Link></div></div>
    {!data.trainingStatus.eligible && <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-xs"><b className="text-amber-300">Dados insuficientes para treinamento</b><span className="ml-2 text-zinc-400">{data.trainingRecords}/{data.trainingStatus.minimum} resultados WON/LOST.</span></div>}
    <div className="grid gap-4 md:grid-cols-3"><div className="card p-5"><Gauge className="text-neon"/><p className="label mt-4">AI Score médio</p><strong className="mt-2 block text-3xl text-neon">{averageAiScore.toFixed(1)}</strong></div><div className="card p-5"><ShieldCheck className="text-gold"/><p className="label mt-4">Confiança média</p><strong className="mt-2 block text-3xl text-gold">{averageConfidence.toFixed(1)}%</strong><span className="mt-1 block text-[9px] text-zinc-600">{data.trainingStatus.confidence.level}</span></div><div className="card p-5"><BrainCircuit className="text-white"/><p className="label mt-4">Registros de treinamento</p><strong className="mt-2 block text-3xl">{data.trainingRecords}</strong></div></div>
    <section className="card mt-6 overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Previsões probabilísticas</p><p className="mt-1 text-[10px] text-zinc-600">{data.methodology}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Jogo</th><th>Mercado</th><th>AI Score</th><th>Confiança</th><th>Score tradicional</th><th>EV</th><th>Risco</th><th>Prob. prevista</th><th>Classificação</th></tr></thead><tbody>{data.predictions.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="px-5 py-4 font-black">{item.game}</td><td>{item.market}<span className="block text-[9px] text-zinc-600">{item.selection}</span></td><td className="text-lg font-black text-neon">{item.aiScore.toFixed(1)}</td><td>{item.modelConfidence.toFixed(1)}%<span className="block text-[9px] text-zinc-600">amostra: {item.sampleSize}</span></td><td>{item.traditionalScore.toFixed(1)}</td><td className="text-gold">{(item.ev * 100).toFixed(1)}%</td><td>{item.risk}</td><td className="font-black">{item.predictedProbability.toFixed(1)}%</td><td><span className={`rounded-md px-2 py-1 text-[9px] font-black ${tone(item.classification)}`}>{item.classification}</span></td></tr>)}</tbody></table></div></section>
    <div className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-4 text-[11px] leading-relaxed text-zinc-400"><b className="text-amber-300">Aviso de responsabilidade:</b> as previsões são probabilísticas, não prometem lucro e não garantem green. Amostras pequenas reduzem a confiança do modelo. Aposte com responsabilidade.</div>
  </>;
}
