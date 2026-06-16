import { Activity, BarChart3, BrainCircuit, Database, ShieldCheck, Target } from "lucide-react";
import { getModelPerformance } from "@/services/modelTrainingService";

export const dynamic = "force-dynamic";

const metric = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(2)}%`;

export default async function ModelPerformancePage() {
  const data = await getModelPerformance();
  const current = data.current;
  const cards = [
    ["Dataset size", data.status.records.toString(), Database], ["Accuracy", metric(current?.accuracy), Target], ["Precision", metric(current?.precision), ShieldCheck], ["Recall", metric(current?.recall), Activity], ["ROI", metric(current?.roi), BarChart3], ["Yield", metric(current?.yield), BarChart3], ["Win Rate", metric(current?.winRate), BrainCircuit],
  ] as const;
  const maxRecords = Math.max(1, ...data.learningCurve.map((item) => item.recordsUsed));
  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Validação temporal</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Model Performance</h1><p className="mt-2 max-w-3xl text-sm text-zinc-500">Métricas calculadas somente no conjunto de teste futuro, preservando a divisão cronológica 70% treino, 15% validação e 15% teste.</p></div>
    {!data.status.eligible && <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-5"><b className="text-amber-300">Dados insuficientes para treinamento</b><p className="mt-2 text-xs text-zinc-400">{data.status.records} de {data.status.minimum} tips liquidadas WON/LOST. Nenhuma métrica de modelo foi estimada.</p></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">{cards.map(([label,value,Icon]) => <div className="card p-5" key={label}><Icon size={16} className="text-neon"/><p className="label mt-4">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></div>)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[.65fr_1.35fr]"><section className="card p-5"><p className="text-sm font-black uppercase tracking-wider">Status do aprendizado</p><div className="mt-5 space-y-4 text-xs"><p className="text-zinc-500">Confiança por volume <b className="float-right text-white">{data.status.confidence.level}</b></p><p className="text-zinc-500">Próximo treinamento <b className="float-right text-white">{data.status.nextTrainingAt} registros</b></p><p className="text-zinc-500">Novos desde a versão <b className="float-right text-white">{data.status.newRecordsSinceTraining}</b></p><p className="text-zinc-500">Versão atual <b className="float-right text-white">{current?.version ?? "Não treinado"}</b></p></div></section><section className="card p-5"><p className="text-sm font-black uppercase tracking-wider">Learning Curve</p><p className="mt-1 text-[10px] text-zinc-600">Evolução real das versões treinadas</p><div className="mt-6 space-y-5">{data.learningCurve.length ? data.learningCurve.map((item) => <div key={item.version}><div className="mb-2 flex justify-between text-xs"><b>{item.version}</b><span className="text-zinc-500">{item.recordsUsed} registros · {item.accuracy.toFixed(1)}% accuracy</span></div><div className="h-3 rounded-full bg-zinc-900"><div className="h-full rounded-full bg-gradient-to-r from-emerald-900 to-neon" style={{ width: `${Math.max(4, item.recordsUsed / maxRecords * 100)}%` }}/></div></div>) : <p className="py-10 text-center text-xs text-zinc-600">A curva será exibida após o primeiro treinamento com 100 resultados reais.</p>}</div></section></div>
    <div className="mt-6 rounded-xl border border-line bg-white/[.02] p-4 text-[11px] leading-relaxed text-zinc-500">Métricas históricas não prometem lucro nem garantem green. O modelo produz estimativas probabilísticas e depende da qualidade e quantidade dos dados reais.</div>
  </>;
}
