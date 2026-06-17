"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BellRing, Clock3, Crosshair, Database, Percent, RefreshCw, ShieldAlert, Target, TrendingUp, TriangleAlert } from "lucide-react";
import { formatDateTimeBrt } from "@/lib/timezone";

type Summary = { gamesToday: number; oddsToday: number; generatedToday: number; settledToday: number; greens: number; reds: number; roi: number; winRate: number; lastSync: string | null; syncStatus: string };
type Opportunity = { id: string; game: string; market: string; selection: string; odd: number; ev: number; score: number; powerRating: number; risk: string; status: string };
type Movement = { id: string; game: string; market: string; selection: string; openingOdd: number; currentOdd: number; variation: number; type: string; timestamp: string | null };
type Alert = { id: string; level: string; title: string; detail: string; reason: string; timestamp: string | null };
type Period = { label: string; roi: number; yield: number; winRate: number; greens: number; reds: number };
type Ranking = { market: string; roi: number; winRate: number; profit: number; entries: number };
type Operational = { providerStatus: string; provider: string; jobsExecuted: number; latestJobName: string; latestJobStatus: string; lastSynchronization: string | null; gamesMonitored: number; oddsPersisted: number; resultsSynced: number; resultSyncStatus: string; settlementsDone: number; settlementStatus: string; settlementRate: number };
type CommandData = { summary: Summary; opportunities: Opportunity[]; movements: Movement[]; alerts: Alert[]; performance: { periods: Period[]; rankings: Ranking[] }; operational: Operational; refreshedAt: string | null; error?: string | null };
type CommandPayload = Partial<CommandData> & { error?: string | null };

const emptySummary: Summary = { gamesToday: 0, oddsToday: 0, generatedToday: 0, settledToday: 0, greens: 0, reds: 0, roi: 0, winRate: 0, lastSync: null, syncStatus: "INSUFFICIENT_REAL_DATA" };
const emptyOperational: Operational = { providerStatus: "PENDING_RESULTS", provider: "NO_ACTIVE_PROVIDER", jobsExecuted: 0, latestJobName: "NO_JOB_RUN", latestJobStatus: "NOT_RUN", lastSynchronization: null, gamesMonitored: 0, oddsPersisted: 0, resultsSynced: 0, resultSyncStatus: "NOT_RUN", settlementsDone: 0, settlementStatus: "NOT_RUN", settlementRate: 0 };
const emptyData: CommandData = { summary: emptySummary, opportunities: [], movements: [], alerts: [], performance: { periods: [], rankings: [] }, operational: emptyOperational, refreshedAt: null, error: null };

const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const textValue = (value: unknown, fallback = "-") => typeof value === "string" && value.trim() ? value : fallback;
const arrayValue = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const formatDate = (value: string | null | undefined) => formatDateTimeBrt(value, "Ainda nao executada");
const signed = (value: number) => `${value > 0 ? "+" : ""}${numberValue(value).toFixed(2)}%`;

function normalizePayload(payload: CommandPayload | null | undefined): CommandData {
  const summary = payload?.summary ?? emptySummary;
  const performance = payload?.performance ?? emptyData.performance;
  const operational = payload?.operational ?? emptyOperational;
  return {
    summary: {
      gamesToday: numberValue(summary.gamesToday),
      oddsToday: numberValue(summary.oddsToday),
      generatedToday: numberValue(summary.generatedToday),
      settledToday: numberValue(summary.settledToday),
      greens: numberValue(summary.greens),
      reds: numberValue(summary.reds),
      roi: numberValue(summary.roi),
      winRate: numberValue(summary.winRate),
      lastSync: typeof summary.lastSync === "string" ? summary.lastSync : null,
      syncStatus: textValue(summary.syncStatus, "INSUFFICIENT_REAL_DATA"),
    },
    opportunities: arrayValue<Opportunity>(payload?.opportunities).map((item, index) => ({
      id: textValue(item.id, `opportunity-${index}`),
      game: textValue(item.game, "PENDING_RESULTS"),
      market: textValue(item.market, "INSUFFICIENT_REAL_DATA"),
      selection: textValue(item.selection, "-"),
      odd: numberValue(item.odd),
      ev: numberValue(item.ev),
      score: numberValue(item.score),
      powerRating: numberValue(item.powerRating),
      risk: textValue(item.risk, "PENDING_RESULTS"),
      status: textValue(item.status, "INSUFFICIENT_REAL_DATA"),
    })),
    movements: arrayValue<Movement>(payload?.movements).map((item, index) => ({
      id: textValue(item.id, `movement-${index}`),
      game: textValue(item.game, "PENDING_RESULTS"),
      market: textValue(item.market, "INSUFFICIENT_REAL_DATA"),
      selection: textValue(item.selection, "-"),
      openingOdd: numberValue(item.openingOdd),
      currentOdd: numberValue(item.currentOdd),
      variation: numberValue(item.variation),
      type: textValue(item.type, "PENDING_RESULTS"),
      timestamp: typeof item.timestamp === "string" ? item.timestamp : null,
    })),
    alerts: arrayValue<Alert>(payload?.alerts).map((item, index) => ({
      id: textValue(item.id, `alert-${index}`),
      level: textValue(item.level, "WATCH"),
      title: textValue(item.title, "PENDING_RESULTS"),
      detail: textValue(item.detail, "Sem alerta operacional disponivel."),
      reason: textValue(item.reason, "INSUFFICIENT_REAL_DATA"),
      timestamp: typeof item.timestamp === "string" ? item.timestamp : null,
    })),
    performance: {
      periods: arrayValue<Period>(performance.periods).map((period, index) => ({
        label: textValue(period.label, `Periodo ${index + 1}`),
        roi: numberValue(period.roi),
        yield: numberValue(period.yield),
        winRate: numberValue(period.winRate),
        greens: numberValue(period.greens),
        reds: numberValue(period.reds),
      })),
      rankings: arrayValue<Ranking>(performance.rankings).map((item, index) => ({
        market: textValue(item.market, `Mercado ${index + 1}`),
        roi: numberValue(item.roi),
        winRate: numberValue(item.winRate),
        profit: numberValue(item.profit),
        entries: numberValue(item.entries),
      })),
    },
    operational: {
      providerStatus: textValue(operational.providerStatus, "PENDING_RESULTS"),
      provider: textValue(operational.provider, "NO_ACTIVE_PROVIDER"),
      jobsExecuted: numberValue(operational.jobsExecuted),
      latestJobName: textValue(operational.latestJobName, "NO_JOB_RUN"),
      latestJobStatus: textValue(operational.latestJobStatus, "NOT_RUN"),
      lastSynchronization: typeof operational.lastSynchronization === "string" ? operational.lastSynchronization : null,
      gamesMonitored: numberValue(operational.gamesMonitored),
      oddsPersisted: numberValue(operational.oddsPersisted),
      resultsSynced: numberValue(operational.resultsSynced),
      resultSyncStatus: textValue(operational.resultSyncStatus, "NOT_RUN"),
      settlementsDone: numberValue(operational.settlementsDone),
      settlementStatus: textValue(operational.settlementStatus, "NOT_RUN"),
      settlementRate: numberValue(operational.settlementRate),
    },
    refreshedAt: typeof payload?.refreshedAt === "string" ? payload.refreshedAt : null,
    error: payload?.error ?? null,
  };
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return <tr><td colSpan={colSpan} className="px-5 py-10 text-center text-xs text-zinc-600">{message}</td></tr>;
}

export function CommandCenterDashboard({ initialData }: { initialData: CommandPayload }) {
  const [payload, setPayload] = useState<CommandPayload>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const data = useMemo(() => normalizePayload(payload), [payload]);

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/command-center", { cache: "no-store" });
      const nextPayload = await response.json().catch(() => ({ error: "Falha ao ler resposta do Command Center." })) as CommandPayload;
      if (!response.ok) setRefreshError(nextPayload.error ?? "Command Center indisponivel.");
      setPayload(nextPayload);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Falha ao atualizar Command Center.");
      setPayload((current) => ({ ...current, error: "PENDING_RESULTS" }));
    } finally { setRefreshing(false); }
  }

  useEffect(() => { void refresh(); const timer = window.setInterval(refresh, 30_000); return () => window.clearInterval(timer); }, []);

  const cards = [
    ["Jogos monitorados hoje", data.summary.gamesToday, Crosshair, "text-white"],
    ["Odds sincronizadas", data.summary.oddsToday, Database, "text-gold"],
    ["Tips geradas", data.summary.generatedToday, BellRing, "text-neon"],
    ["Tips liquidadas", data.summary.settledToday, Target, "text-white"],
    ["Greens", data.summary.greens, TrendingUp, "text-neon"],
    ["Reds", data.summary.reds, ShieldAlert, "text-red-400"],
    ["ROI acumulado", `${data.summary.roi.toFixed(2)}%`, Percent, data.summary.roi >= 0 ? "text-neon" : "text-red-400"],
    ["Win Rate", `${data.summary.winRate.toFixed(1)}%`, Activity, "text-gold"],
  ] as const;
  const operationalCards = [
    ["Provider Status", data.operational.providerStatus, data.operational.provider],
    ["Jobs Executados", data.operational.jobsExecuted, `${data.operational.latestJobName} · ${data.operational.latestJobStatus}`],
    ["Ultima Sincronizacao", formatDate(data.operational.lastSynchronization), data.operational.resultSyncStatus],
    ["Jogos Monitorados", data.operational.gamesMonitored, "matches"],
    ["Odds Persistidas", data.operational.oddsPersisted, "odds_snapshots"],
    ["Resultados Sincronizados", data.operational.resultsSynced, "match_results"],
    ["Liquidacoes Realizadas", data.operational.settlementsDone, data.operational.settlementStatus],
    ["Taxa de Liquidacao", `${data.operational.settlementRate.toFixed(1)}%`, "settlement_audits"],
  ] as const;
  const errorMessage = refreshError ?? data.error;

  return <>
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="label mb-2 text-neon">Central de operações</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Green Command Center</h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">Monitoramento, auditoria e evolução contínua do motor analítico.</p></div><button onClick={refresh} disabled={refreshing} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white/[.03] px-4 py-3 text-[10px] font-black uppercase text-zinc-300 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""}/> {refreshing ? "Atualizando" : "Atualizar agora"}</button></div>
    {errorMessage && <div className="mb-5 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-xs text-amber-200"><TriangleAlert size={16} className="shrink-0"/><span>{errorMessage}. Dados indisponiveis ficam como INSUFFICIENT_REAL_DATA ou PENDING_RESULTS.</span></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon,tone]) => <div className="card p-5" key={label}><div className="flex items-center justify-between"><p className="label">{label}</p><Icon size={16} className={tone}/></div><strong className={`mt-4 block break-words text-3xl ${tone}`}>{value}</strong></div>)}</div>
    <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4 text-[11px] text-zinc-500"><span className="flex items-center gap-2"><Clock3 size={14} className="text-neon"/>Última sincronização: <b className="text-white">{formatDate(data.summary.lastSync)}</b></span><span>Status: <b className={data.summary.syncStatus === "SUCCESS" ? "text-neon" : "text-amber-300"}>{data.summary.syncStatus}</b> · atualizado em {formatDate(data.refreshedAt)}</span></div>

    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Fallback operacional real</p><p className="mt-1 text-[10px] text-zinc-600">Contagens persistidas enquanto a base real de resultados liquidados cresce organicamente.</p></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {operationalCards.map(([label, value, detail]) => <div className="border-b border-line/60 p-5 sm:border-r" key={label}><p className="label">{label}</p><strong className="mt-3 block break-words text-xl text-white">{value}</strong><span className="mt-2 block break-words text-[10px] text-zinc-600">{detail}</span></div>)}
      </div>
    </section>

    <section className="card mt-6 overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Top 20 oportunidades</p><p className="mt-1 text-[10px] text-zinc-600">Priorização em tempo real por EV e score</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Jogo</th><th>Mercado</th><th>Odd</th><th>EV</th><th>Score</th><th>Power Rating</th><th>Risco</th><th>Status</th></tr></thead><tbody>{data.opportunities.length ? data.opportunities.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="px-5 py-4 font-black">{item.game}</td><td>{item.market}<span className="block text-[9px] text-zinc-600">{item.selection}</span></td><td className="font-black text-gold">{item.odd.toFixed(2)}</td><td className="font-black text-neon">{signed(item.ev)}</td><td>{item.score.toFixed(1)}</td><td>{item.powerRating.toFixed(1)}</td><td>{item.risk}</td><td className="font-black text-neon">{item.status}</td></tr>) : <EmptyRow colSpan={8} message="INSUFFICIENT_REAL_DATA: nenhuma oportunidade pendente disponivel."/>}</tbody></table></div></section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="card overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Odds Movement</p><p className="mt-1 text-[10px] text-zinc-600">Abertura, subida, queda e fechamento</p></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Jogo / mercado</th><th>Inicial</th><th>Atual</th><th>Variação</th><th>Evento</th><th>Timestamp</th></tr></thead><tbody>{data.movements.length ? data.movements.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="px-5 py-4 font-bold">{item.game}<span className="block text-[9px] text-zinc-600">{item.market} · {item.selection}</span></td><td>{item.openingOdd.toFixed(2)}</td><td className="font-black text-gold">{item.currentOdd.toFixed(2)}</td><td className={item.variation > 0 ? "text-neon" : item.variation < 0 ? "text-red-400" : "text-zinc-400"}>{signed(item.variation)}</td><td>{item.type}</td><td className="text-[10px] text-zinc-500">{formatDate(item.timestamp)}</td></tr>) : <EmptyRow colSpan={6} message="PENDING_RESULTS: movimentos de odds ainda nao disponiveis."/>}</tbody></table></div></section><section className="card overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Smart Alerts</p><p className="mt-1 text-[10px] text-zinc-600">Score, EV e movimentos relevantes</p></div><div className="max-h-[520px] divide-y divide-line/60 overflow-y-auto">{data.alerts.length ? data.alerts.map((alert) => <div className="p-4" key={alert.id}><span className={`rounded-md px-2 py-1 text-[8px] font-black ${alert.level === "ELITE" ? "bg-neon/10 text-neon" : alert.level === "PREMIUM" ? "bg-gold/10 text-gold" : "bg-amber-400/10 text-amber-300"}`}>{alert.level}</span><p className="mt-3 text-xs font-black">{alert.title}</p><p className="mt-1 text-[10px] text-zinc-500">{alert.detail}</p><p className="mt-2 text-[10px] text-white">{alert.reason}</p></div>) : <p className="p-5 text-xs text-zinc-600">Nenhum alerta ativo. PENDING_RESULTS.</p>}</div></section></div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><section className="card p-5"><p className="text-sm font-black uppercase tracking-wider">Monitor de performance</p><div className="mt-5 space-y-3">{data.performance.periods.length ? data.performance.periods.map((period) => <div key={period.label} className="rounded-xl border border-line bg-white/[.02] p-4"><b className="text-xs">{period.label}</b><div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5"><div><p className="label">ROI</p><strong className="text-neon">{period.roi.toFixed(2)}%</strong></div><div><p className="label">Yield</p><strong>{period.yield.toFixed(2)}%</strong></div><div><p className="label">Win Rate</p><strong>{period.winRate.toFixed(1)}%</strong></div><div><p className="label">Greens</p><strong className="text-neon">{period.greens}</strong></div><div><p className="label">Reds</p><strong className="text-red-400">{period.reds}</strong></div></div></div>) : <p className="rounded-xl border border-line p-5 text-xs text-zinc-600">INSUFFICIENT_REAL_DATA: performance ainda sem amostra real liquidada.</p>}</div></section><section className="card overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Ranking de mercados</p><p className="mt-1 text-[10px] text-zinc-600">Ordenado por ROI, Win Rate e lucro acumulado</p></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">#</th><th>Mercado</th><th>ROI</th><th>Win Rate</th><th>Lucro</th><th>Entradas</th></tr></thead><tbody>{data.performance.rankings.length ? data.performance.rankings.map((item,index) => <tr key={`${item.market}-${index}`} className="border-b border-line/60"><td className="px-5 py-4 text-zinc-600">{index+1}</td><td className="font-black">{item.market}</td><td className={item.roi >= 0 ? "text-neon" : "text-red-400"}>{item.roi.toFixed(2)}%</td><td>{item.winRate.toFixed(1)}%</td><td>{item.profit > 0 ? "+" : ""}{item.profit.toFixed(2)}u</td><td>{item.entries}</td></tr>) : <EmptyRow colSpan={6} message="INSUFFICIENT_REAL_DATA: ranking depende de resultados liquidados."/>}</tbody></table></div></section></div>
    <div className="mt-6 rounded-xl border border-line bg-white/[.02] p-4 text-[11px] leading-relaxed text-zinc-500">As analises sao estatisticas, nao prometem lucro e nao garantem resultados positivos. Aposte com responsabilidade e respeite seus limites.</div>
  </>;
}
