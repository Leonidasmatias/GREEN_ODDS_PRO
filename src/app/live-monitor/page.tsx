import { Activity, Radio, ShieldCheck } from "lucide-react";
import { OddsHistoryChart } from "@/components/OddsHistoryChart";
import { ValueOpportunityTable } from "@/components/ValueOpportunityTable";
import { getLiveMonitor } from "@/services/liveDataService";
import { buildValueReport } from "@/services/valueEngine";

export const dynamic = "force-dynamic";

export default async function LiveMonitorPage() {
  const [data, valueReport] = await Promise.all([getLiveMonitor(), buildValueReport()]);
  const liveValues = [...valueReport.entries, ...valueReport.watchlist].filter((item) => item.matchStatus === "LIVE");
  return <>
    <div className="mb-7">
      <p className="label mb-2 text-neon">Real-time monitor</p>
      <h1 className="text-3xl font-black md:text-4xl">Live Data Monitor</h1>
      <p className="mt-2 text-sm text-zinc-500">Jogos, odds e sinais provenientes de APIs licenciadas configuradas.</p>
    </div>
    <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
      <span><Radio size={14} className="mr-2 inline text-red-400"/>{data.matches.length} jogos ao vivo</span>
      <span className="text-zinc-500">Filtro: <b className="text-white">{data.configuration.competitionFilter}</b> · Prioridade: {data.configuration.priority.join(" -> ")}</span>
    </div>
    {data.matches.length ? data.matches.map((match) => <section key={match.id} className="card mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
        <div><p className="label text-neon">{match.competition}</p><h2 className="mt-1 text-lg font-black">{match.game}</h2></div>
        <strong className="text-xl">{match.score ?? "AO VIVO"}</strong>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-2">{match.markets.map((market) => <div key={market.key} className="rounded-xl border border-line p-4">
        <div className="flex justify-between text-xs"><b>{market.market} · {market.selection}</b><span className="text-gold">{market.closing.toFixed(2)}</span></div>
        <OddsHistoryChart values={market.history.map((item) => item.odd)}/>
        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
          <div><p className="label">Abertura</p><b>{market.opening.toFixed(2)}</b></div>
          <div><p className="label">Fechamento</p><b>{market.closing.toFixed(2)}</b></div>
          <div><p className="label">Maior</p><b className="text-neon">{market.high.toFixed(2)}</b></div>
          <div><p className="label">Menor</p><b className="text-red-400">{market.low.toFixed(2)}</b></div>
        </div>
      </div>)}</div>
      {match.tips.length > 0 && <div className="border-t border-line p-5"><p className="label mb-3">Tips ativas</p>{match.tips.map((tip) => <div key={tip.id} className="grid grid-cols-5 gap-3 rounded-lg bg-white/[.02] p-3 text-xs"><b>{tip.market}</b><span>{tip.selection}</span><span>Score {tip.score.toFixed(1)}</span><span>EV {tip.ev.toFixed(1)}%</span><span>AI {tip.aiScore?.toFixed(1) ?? "-"}</span></div>)}</div>}
    </section>) : <div className="card py-16 text-center text-sm text-zinc-600"><Activity className="mx-auto mb-3"/>Nenhum jogo ao vivo de provider licenciado no momento.</div>}
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-4"><p className="text-sm font-black uppercase">Value Engine ao vivo</p><p className="mt-1 text-[10px] text-zinc-600">{valueReport.provider} · edge, EV e risco calculados somente com historico real suficiente.</p></div>
      <ValueOpportunityTable items={liveValues}/>
    </section>
    <section className="card mt-6 p-5">
      <p className="text-sm font-black uppercase">Provider Health</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.providerHealth.map((provider) => <div key={provider.id} className="rounded-xl border border-line p-4 text-xs">
        <ShieldCheck className={provider.status === "SUCCESS" || provider.status === "READY" ? "text-neon" : "text-amber-300"} size={16}/>
        <b className="mt-3 block">{provider.id}</b>
        <p className="mt-2 text-zinc-500">Status: {provider.status}</p>
        <p className="text-zinc-500">Latencia: {provider.latencyMs ?? "-"} ms</p>
        <p className="text-zinc-500">Chamadas: {provider.callsMade}</p>
        <p className="text-zinc-500">Limite: {provider.remainingLimit ?? "-"}</p>
        <p className="text-zinc-500">Falhas: {provider.failures}</p>
      </div>)}</div>
    </section>
    <div className="mt-6 rounded-xl border border-line p-4 text-[11px] text-zinc-500">Scores e previsoes sao probabilisticos. Nao ha promessa de lucro nem garantia de green. Aposte com responsabilidade.</div>
  </>;
}
