import { prisma } from "@/lib/prisma";
import type { Game } from "@/lib/types";
import { getProviderHealth } from "@/providers/providerManager";
import { parseProviderSyncMetadata } from "./providerSyncMetadata";

type LatestValueAnalysis = {
  id: string;
  provider: string;
  market: string;
  selection: string;
  odd: number;
  status: string;
  classification: string;
  confidence: number;
  score: number;
  analyzedAt: string;
};

type LatestGreenScore = {
  id: string;
  provider: string;
  gameLabel: string;
  market: string;
  selection: string;
  odd: number;
  greenScore: number;
  confidence: number;
  risk: string;
  classification: string;
  qualifiesOddsOfDay: boolean;
  analyzedAt: string;
};

type LatestJob = {
  id: string;
  name: string;
  status: string;
  durationMs: number | null;
  completedAt: string | null;
  scheduledAt: string;
  message: string | null;
};

type EngineRun = {
  status: string;
  at: string | null;
  detail?: string | null;
};

export type DashboardSnapshot = {
  generatedAt: string;
  provider: string;
  /** Sprint 9.2.1 — true quando algum provider configurado esta autenticado e sem falha (independente de ter eventos agora). */
  providerHealthy: boolean;
  cacheActive: boolean;
  cacheUpdatedAt: string | null;
  creditsRemaining: number | null;
  lastSyncAt: string | null;
  syncStatus: string;
  syncWarning: string | null;
  /** Sprint 9.2.1 (Fase 5) — esporte/liga/mercado e contagens da ultima sincronizacao real, lidos de AuditLog (PROVIDER_SYNC). */
  sport: string | null;
  league: string | null;
  market: string | null;
  eventsFound: number | null;
  eventsPersisted: number | null;
  oddsFound: number | null;
  oddsPersisted: number | null;
  /** Latencia da ultima chamada real ao provider (ms), quando disponivel. */
  latencyMs: number | null;
  /** true quando o provider esta saudavel mas nenhuma liga monitorada tem eventos agora — nunca deve ser confundido com "provider ativo: none". */
  noActiveLeagueEvents: boolean;
  counts: {
    matches: number;
    liveMatches: number;
    oddsSnapshots: number;
    tipsPending: number;
    tipsSettled: number;
    valueAnalyses: number;
    greenScoreAnalyses: number;
    oddsOfDay: number;
  };
  settlement: {
    won: number;
    lost: number;
    voids: number;
    profit: number;
    roi: number;
    winRate: number;
  };
  games: Game[];
  latestValueAnalyses: LatestValueAnalysis[];
  latestGreenScores: LatestGreenScore[];
  latestJobs: LatestJob[];
  engineRuns: {
    ml: EngineRun;
    discovery: EngineRun;
    performanceAttribution: EngineRun;
    adaptiveStrategy: EngineRun;
    dataQuality: EngineRun;
    resultSync: EngineRun;
  };
  emptyMessage: string | null;
};

const toIso = (value: Date | null | undefined) => value?.toISOString() ?? null;

function gameFromMatch(match: {
  id: string;
  providerId: string | null;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  oddsSnapshots: Array<{ market: string; selection: string; odd: number }>;
}): Game {
  const h2h = match.oddsSnapshots.filter((odd) => odd.market.toLowerCase().includes("h2h") || odd.market.toLowerCase().includes("winner"));
  const home = Math.max(0, ...h2h.filter((odd) => odd.selection === match.homeTeam).map((odd) => odd.odd));
  const away = Math.max(0, ...h2h.filter((odd) => odd.selection === match.awayTeam).map((odd) => odd.odd));
  const draw = Math.max(0, ...h2h.filter((odd) => ["draw", "empate"].includes(odd.selection.toLowerCase())).map((odd) => odd.odd));
  return {
    id: match.providerId ?? match.id,
    competition: match.competition,
    group: match.competition,
    time: match.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
    home: match.homeTeam,
    away: match.awayTeam,
    homeCode: match.homeTeam.slice(0, 3).toUpperCase(),
    awayCode: match.awayTeam.slice(0, 3).toUpperCase(),
    status: match.status === "LIVE" ? "Ao vivo" : match.status === "FINISHED" ? "Encerrado" : "Pré-jogo",
    score: match.homeScore == null ? undefined : `${match.homeScore} - ${match.awayScore}`,
    odds: { home, draw, away },
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const startedAt = Date.now();
  console.log("[dashboard] snapshot start");

  const [
    matches,
    liveMatches,
    oddsSnapshots,
    tipsPending,
    tipsWon,
    tipsLost,
    tipsVoid,
    valueAnalyses,
    greenScoreAnalyses,
    oddsOfDay,
    latestSync,
    latestProviderCall,
    latestCache,
    latestMatches,
    latestValues,
    latestGreens,
    latestJobs,
    mlRun,
    discoveryRun,
    performanceRun,
    adaptiveRun,
    dataQualityRun,
    resultSyncRun,
  ] = await Promise.all([
    prisma.match.count().catch(() => 0),
    prisma.match.count({ where: { status: "LIVE" } }).catch(() => 0),
    prisma.oddsSnapshot.count().catch(() => 0),
    prisma.tip.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.tip.count({ where: { status: "WON" } }).catch(() => 0),
    prisma.tip.count({ where: { status: "LOST" } }).catch(() => 0),
    prisma.tip.count({ where: { status: "VOID" } }).catch(() => 0),
    prisma.valueAnalysis.count().catch(() => 0),
    prisma.greenScoreAnalysis.count().catch(() => 0),
    prisma.greenScoreAnalysis.count({ where: { qualifiesOddsOfDay: true } }).catch(() => 0),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.providerCall.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.providerCache.findFirst({ orderBy: { updatedAt: "desc" } }).catch(() => null),
    prisma.match.findMany({ orderBy: { startsAt: "asc" }, take: 12, include: { oddsSnapshots: { orderBy: { capturedAt: "desc" }, take: 12 } } }).catch(() => []),
    prisma.valueAnalysis.findMany({ orderBy: { analyzedAt: "desc" }, take: 8 }).catch(() => []),
    prisma.greenScoreAnalysis.findMany({ orderBy: [{ qualifiesOddsOfDay: "desc" }, { greenScore: "desc" }, { analyzedAt: "desc" }], take: 8 }).catch(() => []),
    prisma.jobRun.findMany({ orderBy: { scheduledAt: "desc" }, take: 8 }).catch(() => []),
    prisma.mlTrainingRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.discoveryRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.performanceAttributionRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.adaptiveStrategyRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.dataQualityRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.resultSyncRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
  ]);

  const settled = tipsWon + tipsLost + tipsVoid;
  const profitRows = await prisma.tip.findMany({
    where: { status: { in: ["WON", "LOST", "VOID"] } },
    select: { profit: true, stake: true, stakeSuggested: true },
    take: 1000,
  }).catch(() => []);
  const profit = profitRows.reduce((sum, tip) => sum + (tip.profit ?? 0), 0);
  const stake = profitRows.reduce((sum, tip) => sum + (tip.stake || tip.stakeSuggested || 0), 0);

  // Sprint 9.2.1 (Fase 5) — a saude do provider (configurado + sem falha)
  // e determinada independentemente de a ultima sincronizacao ter
  // encontrado eventos, para nunca exibir "Provider ativo: none" quando
  // a API esta, de fato, saudavel — apenas sem jogos nas ligas
  // monitoradas neste momento.
  const [providerHealth, latestSyncAudit] = await Promise.all([
    getProviderHealth().catch(() => []),
    prisma.auditLog.findFirst({ where: { category: "PROVIDER_SYNC" }, orderBy: { createdAt: "desc" } }).catch(() => null),
  ]);
  const healthyProvider = providerHealth.find((item) => item.configured && item.status !== "FAILED" && item.status !== "NOT_CONFIGURED");
  const configuredProvider = providerHealth.find((item) => item.configured);
  const providerHealthy = Boolean(healthyProvider);
  const provider = healthyProvider?.id ?? configuredProvider?.id ?? latestSync?.provider ?? latestProviderCall?.provider ?? latestCache?.provider ?? "none";
  const syncMetadata = parseProviderSyncMetadata(latestSyncAudit?.metadata);
  const noActiveLeagueEvents = providerHealthy && matches === 0 && syncMetadata !== null && (syncMetadata.eventsFound ?? 0) === 0;

  const snapshot: DashboardSnapshot = {
    generatedAt: new Date().toISOString(),
    provider,
    providerHealthy,
    cacheActive: Boolean(latestCache && latestCache.expiresAt > new Date()),
    cacheUpdatedAt: toIso(latestCache?.updatedAt),
    creditsRemaining: latestProviderCall?.remainingLimit ?? null,
    lastSyncAt: toIso(latestSync?.completedAt ?? latestSync?.startedAt),
    syncStatus: latestSync?.status ?? "NOT_RUN",
    syncWarning: latestSync?.warning ?? null,
    sport: syncMetadata?.sport ?? null,
    league: syncMetadata?.league ?? null,
    market: syncMetadata?.market ?? null,
    eventsFound: syncMetadata?.eventsFound ?? null,
    eventsPersisted: syncMetadata?.eventsPersisted ?? null,
    oddsFound: syncMetadata?.oddsFound ?? null,
    oddsPersisted: syncMetadata?.oddsPersisted ?? null,
    latencyMs: healthyProvider?.latencyMs ?? configuredProvider?.latencyMs ?? null,
    noActiveLeagueEvents,
    counts: { matches, liveMatches, oddsSnapshots, tipsPending, tipsSettled: settled, valueAnalyses, greenScoreAnalyses, oddsOfDay },
    settlement: {
      won: tipsWon,
      lost: tipsLost,
      voids: tipsVoid,
      profit,
      roi: stake ? profit / stake * 100 : 0,
      winRate: tipsWon + tipsLost ? tipsWon / (tipsWon + tipsLost) : 0,
    },
    games: latestMatches.map(gameFromMatch),
    latestValueAnalyses: latestValues.map((item) => ({
      id: item.id,
      provider: item.provider,
      market: item.market,
      selection: item.selection,
      odd: item.odd,
      status: item.status,
      classification: item.classification,
      confidence: item.confidence,
      score: item.score,
      analyzedAt: item.analyzedAt.toISOString(),
    })),
    latestGreenScores: latestGreens.map((item) => ({
      id: item.id,
      provider: item.provider,
      gameLabel: item.gameLabel,
      market: item.market,
      selection: item.selection,
      odd: item.odd,
      greenScore: item.greenScore,
      confidence: item.confidence,
      risk: item.risk,
      classification: item.classification,
      qualifiesOddsOfDay: item.qualifiesOddsOfDay,
      analyzedAt: item.analyzedAt.toISOString(),
    })),
    latestJobs: latestJobs.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      durationMs: item.durationMs,
      completedAt: toIso(item.completedAt),
      scheduledAt: item.scheduledAt.toISOString(),
      message: item.message,
    })),
    engineRuns: {
      ml: { status: mlRun?.status ?? "PENDING", at: toIso(mlRun?.finishedAt ?? mlRun?.startedAt), detail: mlRun?.notes },
      discovery: { status: discoveryRun?.status ?? "PENDING", at: toIso(discoveryRun?.finishedAt ?? discoveryRun?.startedAt), detail: discoveryRun?.notes },
      performanceAttribution: { status: performanceRun?.status ?? "PENDING", at: toIso(performanceRun?.finishedAt ?? performanceRun?.startedAt), detail: performanceRun?.notes },
      adaptiveStrategy: { status: adaptiveRun?.status ?? "PENDING", at: toIso(adaptiveRun?.finishedAt ?? adaptiveRun?.startedAt), detail: adaptiveRun?.notes },
      dataQuality: { status: dataQualityRun?.status ?? "PENDING", at: toIso(dataQualityRun?.finishedAt ?? dataQualityRun?.startedAt), detail: dataQualityRun?.classification },
      resultSync: { status: resultSyncRun?.status ?? "PENDING", at: toIso(resultSyncRun?.finishedAt ?? resultSyncRun?.startedAt), detail: resultSyncRun?.errors ?? resultSyncRun?.notes },
    },
    emptyMessage:
      matches || oddsSnapshots || valueAnalyses || greenScoreAnalyses
        ? null
        : noActiveLeagueEvents
          ? "Provider conectado e saudavel, mas nenhuma liga monitorada tem eventos no momento."
          : "Dados ainda nao processados pelo worker.",
  };

  console.log(`[dashboard] snapshot ready durationMs=${Date.now() - startedAt}`);
  return snapshot;
}
