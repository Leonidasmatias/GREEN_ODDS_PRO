// Sprint 6.5 — Prediction Center.
// Lógica de seleção/categorização puramente presentacional do Prediction
// Center. Extraída como funções puras, livres de DOM e de texto em
// português (todo texto vive em `predictionCenterFormatters.ts`), para
// serem testáveis pela infraestrutura de testes já existente
// (`node --test`, sem `@testing-library`/jsdom). Opera SOMENTE sobre
// dados já calculados pelo Prediction Orchestrator (`quality`,
// `warnings`, `markets`) — nunca recalcula probabilidade, score, placar
// ou classificação alguma; apenas seleciona (máximo) e categoriza
// (rubrica determinística sobre sinais já classificados pelos motores).

// Imports relativos (não `@/`) — mesma justificativa documentada em
// `predictionCenterFormatters.ts` (executável também por `node --test`).
import type {
  ConsistencyLevel,
  DataSufficiencyStatus,
  MarketViewModel,
  PredictionCenterItemStatus,
  PredictionRiskLevel,
  PredictionRiskReasonCode,
} from "./predictionCenterTypes.ts";

const RISK_LEVELS: PredictionRiskLevel[] = ["LOW", "MEDIUM", "HIGH", "ELEVATED"];

/**
 * Seleciona o mercado de MAIOR probabilidade dentre os já calculados.
 * Nunca é um cálculo de valor/edge (não há dados de odds em
 * `PredictionResult`) — é estritamente "maior probabilidade segundo o
 * modelo". Empates resolvidos pela primeira ocorrência (ordem estável,
 * nunca aleatória). Retorna `null` quando `markets` está vazio ou quando
 * nenhum item tem `probabilityValue` não-nulo.
 */
export function selectBestMarket(markets: MarketViewModel[]): MarketViewModel | null {
  let best: MarketViewModel | null = null;
  for (const market of markets) {
    if (market.probabilityValue === null) continue;
    if (best === null || market.probabilityValue > (best.probabilityValue as number)) {
      best = market;
    }
  }
  return best;
}

export type PredictionRiskClassification = {
  level: PredictionRiskLevel;
  rank: number;
  reasonCodes: PredictionRiskReasonCode[];
};

/**
 * Classifica o risco de UMA previsão a partir de sinais já calculados
 * pelo Prediction Orchestrator (`quality.combinedStatus`,
 * `quality.consistency.level`, `warnings.length`) — nunca um novo
 * indicador estatístico, apenas uma rubrica determinística de
 * agravamento por sinal negativo já existente:
 *
 * 1. `combinedStatus === "LIMITED"` eleva o rank para pelo menos MEDIUM.
 * 2. `combinedStatus === "INSUFFICIENT"` eleva o rank para pelo menos HIGH.
 * 3. `consistencyLevel === "MINOR_DIVERGENCE"` eleva para pelo menos MEDIUM.
 * 4. `consistencyLevel === "MAJOR_DIVERGENCE"` eleva para pelo menos HIGH.
 * 5. Ambos "INSUFFICIENT" + "MAJOR_DIVERGENCE" simultâneos: ELEVATED
 *    (pior caso — os dois motores fundamentalmente não-confiáveis/divergentes).
 * 6. `warningsCount > 0` soma +1 rank (capado em ELEVATED).
 *
 * Determinístico e puro — mesma entrada sempre produz a mesma saída.
 */
export function classifyPredictionRisk(input: {
  combinedStatus: DataSufficiencyStatus;
  consistencyLevel: ConsistencyLevel;
  warningsCount: number;
}): PredictionRiskClassification {
  const reasonCodes: PredictionRiskReasonCode[] = [];
  let rank = 0;

  if (input.combinedStatus === "LIMITED") {
    rank = Math.max(rank, 1);
    reasonCodes.push("LIMITED_DATA_SUFFICIENCY");
  }
  if (input.combinedStatus === "INSUFFICIENT") {
    rank = Math.max(rank, 2);
    reasonCodes.push("INSUFFICIENT_DATA_SUFFICIENCY");
  }
  if (input.consistencyLevel === "MINOR_DIVERGENCE") {
    rank = Math.max(rank, 1);
    reasonCodes.push("MINOR_ENGINE_DIVERGENCE");
  }
  if (input.consistencyLevel === "MAJOR_DIVERGENCE") {
    rank = Math.max(rank, 2);
    reasonCodes.push("MAJOR_ENGINE_DIVERGENCE");
  }
  if (input.combinedStatus === "INSUFFICIENT" && input.consistencyLevel === "MAJOR_DIVERGENCE") {
    rank = 3;
  }
  if (input.warningsCount > 0) {
    rank = Math.min(rank + 1, 3);
    reasonCodes.push("ENGINE_WARNINGS_PRESENT");
  }

  return { level: RISK_LEVELS[rank], rank, reasonCodes };
}

/** Deriva o status de degradação de UM item a partir do mesmo `rank`
 * produzido por `classifyPredictionRisk` — nunca uma condição paralela
 * recalculada (rank 0 = "success", qualquer rank > 0 = "partial"). */
export function deriveItemStatus(rank: number): PredictionCenterItemStatus {
  return rank === 0 ? "success" : "partial";
}

/**
 * Consolida o status de um lote de itens no status do
 * `PredictionCenterDataResult` — o pior caso entre os itens ("partial"
 * se QUALQUER item for "partial", "success" somente se todos forem).
 * Nunca decide nada novo: apenas agrega decisões já tomadas por item.
 */
export function rollupItemsStatus(items: { status: PredictionCenterItemStatus }[]): "success" | "partial" {
  return items.some((item) => item.status === "partial") ? "partial" : "success";
}
