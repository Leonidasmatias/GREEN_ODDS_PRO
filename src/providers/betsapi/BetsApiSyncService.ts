// Fase 3 - BetsAPI Real Integration.
// BetsApiSyncService: orquestra uma sincronizacao real (ou simulada, em
// dry-run) contra a BetsAPI, sempre respeitando os limites de paginas e
// eventos por execucao, a classificacao eSoccer, e as feature flags de
// persistencia/aggregation. Reaproveita a IngestionPipeline da Fase 2
// (inalterada) como motor de normalizacao/validacao/deduplicacao -
// este servico apenas decide QUAIS eventos brutos chegam ate ela e QUAIS
// stages de persistencia/aggregation ficam ativos, conforme o modo.
//
// Modos:
//   dry-run  - consulta, normaliza, valida, deduplica em memoria; NUNCA
//              persiste nem executa aggregation.
//   sandbox  - consulta dados reais explicitamente; NUNCA persiste por
//              padrao (persist/aggregation sempre no-op neste modo).
//   live     - so persiste/agrega se as flags BETSAPI_PERSIST_ENABLED /
//              BETSAPI_AGGREGATION_ENABLED estiverem ligadas; somente
//              eventos confirmed_esoccer sao elegiveis a persistencia.

import type { MatchProvider } from "../contracts/index.ts";
import type { ProviderName } from "../types/dto.ts";
import { InMemoryMatchProviderBase } from "../base/InMemoryMatchProvider.ts";
import { IngestionPipeline, type AggregationStage, type PersistenceStage } from "../pipeline/IngestionPipeline.ts";
import { DeduplicationService } from "../pipeline/DeduplicationService.ts";
import { PipelineEventBus } from "../pipeline/PipelineEvents.ts";
import { PipelineLogger } from "../pipeline/PipelineLogger.ts";
import { normalizeProviderMatch } from "../pipeline/ProviderNormalizer.ts";
import { betsApiTimeToISO, type BetsApiRawMatch } from "./BetsApiAdapter.ts";
import type { BetsApiClient } from "./BetsApiClient.ts";
import type { BetsApiFeatureFlags } from "./BetsApiConfig.ts";
import { classifyEsoccerEvent, type EsoccerClassifierConfig } from "./EsoccerClassifier.ts";
import { betsApiEventToRawMatch, type BetsApiRawEvent } from "./BetsApiPayloads.ts";
import { parseESoccerParticipant } from "../../lib/esoccer/participantParser.ts";

export type BetsApiSyncMode = "dry-run" | "sandbox" | "live";

export type BetsApiSyncReport = {
  provider: "BETSAPI";
  endpoint: string;
  mode: BetsApiSyncMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pagesProcessed: number;
  eventsReceived: number;
  confirmedEsoccer: number;
  probableEsoccer: number;
  rejected: number;
  duplicated: number;
  imported: number;
  updated: number;
  errors: number;
  rateLimitRemaining: number | null;
  persistenceEnabled: boolean;
  aggregationEnabled: boolean;
};

export type BetsApiSyncServiceOptions = {
  client: BetsApiClient;
  sportId: string;
  classifierConfig: EsoccerClassifierConfig;
  featureFlags: BetsApiFeatureFlags;
  persist?: PersistenceStage;
  runAggregation?: AggregationStage;
  deduplicator?: DeduplicationService;
  logger?: PipelineLogger;
  eventBus?: PipelineEventBus;
};

function extractNickname(rawName: string): string {
  try {
    return parseESoccerParticipant(rawName).playerNickname;
  } catch {
    return rawName;
  }
}

class SyncBatchProvider extends InMemoryMatchProviderBase<BetsApiRawMatch> implements MatchProvider<BetsApiRawMatch> {
  readonly name: ProviderName = "BETSAPI";
  constructor(records: BetsApiRawMatch[]) {
    super(records, {
      getExternalId: (record) => record.id,
      getScheduledAt: (record) => betsApiTimeToISO(record.time),
      getPlayerNicknames: (record) => [extractNickname(record.home.name), extractNickname(record.away.name)],
      getLeagueName: (record) => record.league.name,
    });
  }
}

export class BetsApiSyncService {
  private readonly options: BetsApiSyncServiceOptions;

  constructor(options: BetsApiSyncServiceOptions) {
    this.options = options;
  }

  async run(mode: BetsApiSyncMode, params: { day?: string } = {}): Promise<BetsApiSyncReport> {
    const startedAt = new Date();
    const maxPages = Math.max(1, this.options.featureFlags.maxPagesPerSync);
    const maxEvents = Math.max(1, this.options.featureFlags.maxEventsPerSync);

    let pagesProcessed = 0;
    let eventsReceived = 0;
    let confirmedEsoccer = 0;
    let probableEsoccer = 0;
    let rejectedByClassifier = 0;
    const eligible: BetsApiRawEvent[] = [];

    outer: for (let page = 1; page <= maxPages; page += 1) {
      const payload = await this.options.client.getUpcomingEvents({ sport_id: this.options.sportId, day: params.day, page });
      pagesProcessed += 1;
      if (payload.results.length === 0) break;

      for (const event of payload.results) {
        if (eventsReceived >= maxEvents) break outer;
        eventsReceived += 1;

        const { classification } = classifyEsoccerEvent(event, this.options.classifierConfig);
        if (classification === "confirmed_esoccer") {
          confirmedEsoccer += 1;
          eligible.push(event);
        } else if (classification === "probable_esoccer") {
          probableEsoccer += 1;
          if (mode !== "live") eligible.push(event);
        } else {
          rejectedByClassifier += 1;
        }
      }
    }

    const rawMatches = eligible.map(betsApiEventToRawMatch);
    const persistenceEnabled = mode === "live" && this.options.featureFlags.persistEnabled;
    const aggregationEnabled = mode === "live" && this.options.featureFlags.aggregationEnabled;

    const pipeline = new IngestionPipeline<BetsApiRawMatch>({
      provider: new SyncBatchProvider(rawMatches),
      normalize: (raw) => normalizeProviderMatch({ provider: "BETSAPI", raw }),
      deduplicator: this.options.deduplicator,
      logger: this.options.logger,
      eventBus: this.options.eventBus,
      persist: persistenceEnabled ? this.options.persist : undefined,
      runAggregation: aggregationEnabled ? this.options.runAggregation : undefined,
    });

    const pipelineSummary = await pipeline.run();
    const finishedAt = new Date();

    return {
      provider: "BETSAPI",
      endpoint: "/v3/events/upcoming",
      mode,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      pagesProcessed,
      eventsReceived,
      confirmedEsoccer,
      probableEsoccer,
      rejected: rejectedByClassifier + pipelineSummary.rejected,
      duplicated: pipelineSummary.duplicated,
      imported: pipelineSummary.imported,
      updated: pipelineSummary.updated,
      errors: pipelineSummary.rejected,
      rateLimitRemaining: this.options.client.getRateLimitState()?.remaining ?? null,
      persistenceEnabled,
      aggregationEnabled,
    };
  }
}
