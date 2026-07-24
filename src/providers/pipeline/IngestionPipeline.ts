// Fase 2 — Data Ingestion Pipeline.
// IngestionPipeline: orquestra o fluxo completo
//   Provider -> Normalizer -> Validator -> Deduplicator -> Persistence -> Aggregation -> Intelligence Engine
// Cada etapa é independente e testável isoladamente (ver
// ProviderNormalizer.test.mjs, MatchValidator.test.mjs,
// DeduplicationService.test.mjs); a Pipeline apenas as compõe.
//
// As etapas de Persistence e Aggregation são injetáveis
// (`persist`/`runAggregation`) e, por padrão, são no-ops nesta fase: a
// missão proíbe alterar o Intelligence Engine e não há banco de dados
// disponível neste ambiente de teste (mesma limitação documentada em
// AggregationEngine.runAggregation(), Fase 1.5). Em produção,
// `persist` gravaria o InternalMatchDTO em ESoccerMatch via Prisma, e
// `runAggregation` chamaria `AggregationEngine.runAggregation()`
// (Fase 1.5) sem nenhuma alteração ao seu código.

import type { MatchProvider } from "../contracts/index.ts";
import type { InternalMatchDTO } from "../types/dto.ts";
import { validateInternalMatch } from "./MatchValidator.ts";
import { DeduplicationService } from "./DeduplicationService.ts";
import { PipelineEventBus, type PipelineRunSummary } from "./PipelineEvents.ts";
import { PipelineLogger } from "./PipelineLogger.ts";

export type PersistenceAction = "CREATE" | "UPDATE";
export type PersistenceStage = (action: PersistenceAction, match: InternalMatchDTO) => Promise<void>;
export type AggregationStage = () => Promise<void>;

export type IngestionPipelineOptions<TRaw> = {
  provider: MatchProvider<TRaw>;
  normalize: (raw: TRaw) => InternalMatchDTO;
  logger?: PipelineLogger;
  eventBus?: PipelineEventBus;
  deduplicator?: DeduplicationService;
  persist?: PersistenceStage;
  runAggregation?: AggregationStage;
};

const NOOP_PERSIST: PersistenceStage = async () => {};
const NOOP_AGGREGATION: AggregationStage = async () => {};

export class IngestionPipeline<TRaw> {
  private readonly provider: MatchProvider<TRaw>;
  private readonly normalize: (raw: TRaw) => InternalMatchDTO;
  private readonly logger: PipelineLogger;
  private readonly eventBus: PipelineEventBus;
  private readonly deduplicator: DeduplicationService;
  private readonly persist: PersistenceStage;
  private readonly runAggregationStage: AggregationStage;

  constructor(options: IngestionPipelineOptions<TRaw>) {
    this.provider = options.provider;
    this.normalize = options.normalize;
    this.logger = options.logger ?? new PipelineLogger();
    this.eventBus = options.eventBus ?? new PipelineEventBus();
    this.deduplicator = options.deduplicator ?? new DeduplicationService();
    this.persist = options.persist ?? NOOP_PERSIST;
    this.runAggregationStage = options.runAggregation ?? NOOP_AGGREGATION;
  }

  get events(): PipelineEventBus {
    return this.eventBus;
  }

  get log(): PipelineLogger {
    return this.logger;
  }

  async run(): Promise<PipelineRunSummary> {
    const startedAt = new Date();
    let imported = 0;
    let updated = 0;
    let duplicated = 0;
    let ignored = 0;
    let rejected = 0;

    const rawMatches = await this.provider.listMatches();

    for (const raw of rawMatches) {
      let match: InternalMatchDTO;
      try {
        match = this.normalize(raw);
      } catch (error) {
        rejected += 1;
        this.eventBus.emit({
          type: "MatchRejected",
          raw,
          errors: [{ field: "normalize", message: (error as Error).message }],
        });
        continue;
      }

      const validation = validateInternalMatch(match);
      if (!validation.valid) {
        rejected += 1;
        this.eventBus.emit({ type: "MatchRejected", raw, errors: validation.errors });
        continue;
      }

      if (match.status !== "FINISHED") {
        ignored += 1;
        this.eventBus.emit({
          type: "MatchIgnored",
          match,
          reason: `Status "${match.status}" ainda não é FINISHED; aguardando resultado definitivo.`,
        });
        continue;
      }

      const outcome = this.deduplicator.evaluate(match);
      if (outcome === "DUPLICATE") {
        duplicated += 1;
        this.eventBus.emit({ type: "MatchDuplicated", match });
        continue;
      }

      await this.persist(outcome === "NEW" ? "CREATE" : "UPDATE", match);
      if (outcome === "NEW") {
        imported += 1;
        this.eventBus.emit({ type: "MatchImported", match });
      } else {
        updated += 1;
        this.eventBus.emit({ type: "MatchUpdated", match });
      }
    }

    await this.runAggregationStage();

    const finishedAt = new Date();
    const summary: PipelineRunSummary = {
      provider: this.provider.name,
      totalRaw: rawMatches.length,
      imported,
      updated,
      duplicated,
      ignored,
      rejected,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };

    this.logger.recordRun(summary);
    this.eventBus.emit({ type: "AggregationCompleted", summary });
    return summary;
  }
}
