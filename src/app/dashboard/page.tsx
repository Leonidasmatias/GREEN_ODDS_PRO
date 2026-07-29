import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CircleDollarSign, Crosshair, Database, History, Radio, TrendingUp } from "lucide-react";
import { SectionHeader } from "@/components/ui";
import { OddsTable } from "@/components/OddsTable";
import { CreatorSignature } from "@/components/CreatorSignature";
import { formatDateTimeBrt } from "@/lib/timezone";
import { requireRouteAccess } from "@/services/authService";
import { getDashboardSnapshot } from "@/services/dashboardSnapshotService";

export const dynamic = "force-dynamic";

const formatDate = (value: string | null | undefined) => formatDateTimeBrt(value, "Ainda nao executado");
const formatNumber = (value: number) => value.toString().padStart(2, "0");
const fallbackMessage = "Dados ainda não processados pelo worker.";

function StatusCard({ label, value, detail, href, icon: Icon, tone = "text-white" }: { label: string; value: string; detail: string; href: string; icon: typeof Activity; tone?: string }) {
  return <Link href={href} className="card group p-5 transition hover:-translate-y-0.5 hover:border-neon/25">
    <div className="flex items-start justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500 transition group-hover:bg-neon/10 group-hover:text-neon"><Icon size={17}/></div><ArrowRight size={14} className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-neon"/></div>
    <p className="label mt-5">{label}</p>
    <p className={`mt-2 text-3xl font-black tracking-tight ${tone}`}>{value}</p>
    <p className="mt-1 text-[10px] text-zinc-600">{detail}</p>
  </Link>;
}

export default async function DashboardPage() {
  await requireRouteAccess("/dashboard");
  const snapshot = await getDashboardSnapshot();
  const showWorkerFallback = Boolean(snapshot.emptyMessage);

  const overviewCards = [
    { label: "Jogos carregados", value: formatNumber(snapshot.counts.matches), detail: snapshot.provider, href: "/odds-do-dia", icon: CalendarDays, tone: "text-white" },
    { label: "Ao vivo", value: formatNumber(snapshot.counts.liveMatches), detail: "partidas persistidas", href: "/live-monitor", icon: Radio, tone: "text-red-400" },
    { label: "Odds salvas", value: snapshot.counts.oddsSnapshots.toString(), detail: "snapshots persistidos", href: "/radar-green", icon: Crosshair, tone: "text-gold" },
    { label: "ROI acumulado", value: `${snapshot.settlement.roi >= 0 ? "+" : ""}${snapshot.settlement.roi.toFixed(1)}%`, detail: `${snapshot.counts.tipsSettled} liquidadas reais`, href: "/performance", icon: TrendingUp, tone: "text-neon" },
    { label: "Taxa de acerto", value: `${(snapshot.settlement.winRate * 100).toFixed(1)}%`, detail: `${snapshot.settlement.won} wins reais`, href: "/performance", icon: History, tone: "text-white" },
    { label: "Lucro real", value: `${snapshot.settlement.profit >= 0 ? "+" : ""}${snapshot.settlement.profit.toFixed(2)}u`, detail: `${snapshot.counts.tipsPending} pendentes`, href: "/performance", icon: CircleDollarSign, tone: "text-gold" },
  ];

  return <>
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_82%_10%,rgba(69,230,138,.13),transparent_30%),linear-gradient(135deg,#121a16,#08100c)] p-6 shadow-glow md:p-9">
      <div className="relative max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/[.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.2em] text-neon"><span className="h-1.5 w-1.5 rounded-full bg-neon"/> Dashboard light mode</div>
        <h1 className="max-w-2xl text-4xl font-black leading-[1.05] md:text-6xl">Centro operacional com <span className="text-neon">leitura leve.</span></h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">Ultimo sync real: {formatDate(snapshot.lastSyncAt)} · Atualizado na tela: {formatDate(snapshot.generatedAt)} · Provider ativo: {snapshot.provider}.</p>
        {snapshot.cacheActive && snapshot.cacheUpdatedAt && <p className="mt-2 text-xs text-amber-200">Dados em cache desde {formatDate(snapshot.cacheUpdatedAt)}.</p>}
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/odds-do-dia" className="flex items-center gap-2 rounded-xl bg-neon px-6 py-3.5 text-xs font-black uppercase tracking-wider text-[#041008]">Ver odds do dia <ArrowRight size={16}/></Link><Link href="/radar-green" className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/[.06] px-6 py-3.5 text-xs font-black uppercase tracking-wider text-gold">Abrir radar <Crosshair size={15}/></Link></div>
      </div>
    </section>

    {showWorkerFallback && <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] px-4 py-3 text-xs text-amber-200">{snapshot.noActiveLeagueEvents ? "Provider conectado e saudavel — nenhuma liga monitorada tem eventos no momento. Nova selecao automatica sera tentada em breve." : fallbackMessage}</div>}
    {snapshot.syncWarning && <div className="mb-6 rounded-xl border border-amber-400/15 bg-amber-400/[.05] px-4 py-3 text-[10px] text-amber-200">{snapshot.syncWarning}</div>}

    <section className="mb-6 grid gap-4 md:grid-cols-3">
      <div className="card p-4"><p className="label">Provider ativo</p><strong className={`mt-2 block text-lg ${snapshot.providerHealthy ? "text-neon" : "text-white"}`}>{snapshot.provider}</strong></div>
      <div className="card p-4"><p className="label">Creditos restantes</p><strong className={`mt-2 block text-lg ${snapshot.creditsRemaining == null ? "text-zinc-500" : snapshot.creditsRemaining <= 5 ? "text-amber-300" : "text-neon"}`}>{snapshot.creditsRemaining ?? "N/A"}</strong></div>
      <div className="card p-4"><p className="label">Sync</p><strong className={`mt-2 block text-lg ${snapshot.syncStatus === "SUCCESS" ? "text-neon" : "text-amber-300"}`}>{snapshot.syncStatus}</strong></div>
    </section>

    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="card p-4"><p className="label">Liga utilizada</p><strong className="mt-2 block text-sm text-white">{snapshot.league ?? snapshot.sport ?? "N/A"}</strong></div>
      <div className="card p-4"><p className="label">Eventos encontrados / persistidos</p><strong className="mt-2 block text-lg text-white">{snapshot.eventsFound ?? "N/A"} / {snapshot.eventsPersisted ?? "N/A"}</strong></div>
      <div className="card p-4"><p className="label">Odds encontradas / persistidas</p><strong className="mt-2 block text-lg text-white">{snapshot.oddsFound ?? "N/A"} / {snapshot.oddsPersisted ?? "N/A"}</strong></div>
      <div className="card p-4"><p className="label">Latencia</p><strong className="mt-2 block text-lg text-white">{snapshot.latencyMs == null ? "N/A" : `${snapshot.latencyMs}ms`}</strong></div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{overviewCards.map((card) => <StatusCard key={card.label} {...card}/>)}</div>

    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["Value Analyses", snapshot.counts.valueAnalyses.toString()],
        ["Green Score", snapshot.counts.greenScoreAnalyses.toString()],
        ["Odds do Dia", snapshot.counts.oddsOfDay.toString()],
        ["Tips WON", snapshot.settlement.won.toString()],
        ["Tips LOST", snapshot.settlement.lost.toString()],
        ["Tips VOID", snapshot.settlement.voids.toString()],
      ].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}
    </section>

    <section className="card mt-6 overflow-hidden p-5">
      <SectionHeader title="Status dos engines" detail="Somente ultimas execucoes persistidas" href="/jobs"/>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {Object.entries(snapshot.engineRuns).map(([name, run]) => <div key={name} className="rounded-xl border border-line bg-white/[.02] p-4">
          <p className="label">{name}</p>
          <strong className="mt-2 block text-sm text-white">{run.status}</strong>
          <span className="mt-1 block text-[10px] text-zinc-600">{formatDate(run.at)}</span>
          {run.detail && <span className="mt-2 block text-[10px] text-amber-200">{run.detail}</span>}
        </div>)}
      </div>
    </section>

    <section className="card mt-6 overflow-hidden p-5">
      <SectionHeader title="Ultimas analises persistidas" detail="Sem processamento no SSR" href="/radar-green"/>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-4 py-3">Mercado</th><th>Odd</th><th>Status</th><th>Classificacao</th><th>Confianca</th><th>Score</th><th>Analisado em</th></tr></thead>
          <tbody>{snapshot.latestValueAnalyses.length ? snapshot.latestValueAnalyses.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="px-4 py-4"><b className="block text-white">{item.market}</b><span className="text-[10px] text-zinc-600">{item.selection} · {item.provider}</span></td><td>{item.odd.toFixed(2)}</td><td>{item.status}</td><td>{item.classification}</td><td>{item.confidence.toFixed(0)}%</td><td>{item.score.toFixed(0)}/100</td><td>{formatDate(item.analyzedAt)}</td></tr>) : <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-600">{fallbackMessage}</td></tr>}</tbody>
        </table>
      </div>
    </section>

    <section className="card mt-6 overflow-hidden p-5">
      <SectionHeader title="Green Score persistido" detail="Leitura de green_score_analyses" href="/odds-do-dia"/>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {snapshot.latestGreenScores.length ? snapshot.latestGreenScores.map((item) => <div key={item.id} className="rounded-xl border border-line bg-white/[.02] p-4">
          <div className="flex items-start justify-between gap-3"><div><b className="text-sm text-white">{item.gameLabel}</b><p className="mt-1 text-[10px] text-zinc-600">{item.market} · {item.selection} · {item.provider}</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${item.qualifiesOddsOfDay ? "border-neon/25 bg-neon/10 text-neon" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>{item.classification}</span></div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-xs"><span><p className="label">Odd</p><b>{item.odd.toFixed(2)}</b></span><span><p className="label">Green</p><b>{item.greenScore}</b></span><span><p className="label">Conf</p><b>{item.confidence}</b></span><span><p className="label">Risk</p><b>{item.risk}</b></span></div>
        </div>) : <div className="rounded-xl border border-line bg-white/[.02] p-8 text-center text-sm text-zinc-600 lg:col-span-2">{fallbackMessage}</div>}
      </div>
    </section>

    <div className="mt-7 grid gap-6 xl:grid-cols-[1.65fr_.55fr]">
      <section><OddsTable games={snapshot.games}/></section>
      <section className="card overflow-hidden p-6">
        <div className="flex items-center justify-between"><div><p className="label text-neon">Snapshot do mercado</p><h2 className="mt-2 text-xl font-black">Resumo persistido</h2></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-neon/10 text-neon"><Database/></div></div>
        <div className="my-7 text-center"><p className="text-6xl font-black tracking-tighter">{snapshot.games.length}</p><p className="mt-2 text-xs text-zinc-500">partidas exibidas</p></div>
        <div className="space-y-3 text-xs text-zinc-500"><p>Provider: <b className="text-white">{snapshot.provider}</b></p><p>Liga: <b className="text-white">{snapshot.league ?? "N/A"}</b></p><p>Mercados: <b className="text-white">{snapshot.market ?? "N/A"}</b></p><p>Ultimo sync real: <b className="text-white">{formatDate(snapshot.lastSyncAt)}</b></p><p>Atualizado na tela: <b className="text-white">{formatDate(snapshot.generatedAt)}</b></p><p>Odds persistidas: <b className="text-white">{snapshot.counts.oddsSnapshots}</b></p><p>Green Scores: <b className="text-white">{snapshot.counts.greenScoreAnalyses}</b></p></div>
      </section>
    </div>

    <section className="card mt-6 overflow-hidden p-5">
      <SectionHeader title="Ultimos jobs" detail="Leitura de job_runs" href="/jobs"/>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-4 py-3">Job</th><th>Status</th><th>Duracao</th><th>Finalizado</th><th>Mensagem</th></tr></thead>
          <tbody>{snapshot.latestJobs.length ? snapshot.latestJobs.map((job) => <tr key={job.id} className="border-b border-line/60"><td className="px-4 py-4 font-black text-white">{job.name}</td><td>{job.status}</td><td>{job.durationMs == null ? "N/A" : `${job.durationMs}ms`}</td><td>{formatDate(job.completedAt ?? job.scheduledAt)}</td><td className="max-w-md truncate text-zinc-500">{job.message ?? "-"}</td></tr>) : <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-600">{fallbackMessage}</td></tr>}</tbody>
        </table>
      </div>
    </section>

    <div className="mt-6"><CreatorSignature compact/></div>
  </>;
}
