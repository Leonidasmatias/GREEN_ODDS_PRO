// Sprint 8.2 — Prediction Dashboard and Timeline.
// Formatadores exclusivos desta feature. Nunca duplica o que já existe
// em `predictionCenterFormatters.ts` — apenas complementa: wrappers
// defensivos para os dois campos que a fronteira de leitura
// (`PredictionSummary`, Sprint 7.4) tipa como `string` bruto de propósito
// (para não acoplar o Query Service ao enum interno do motor), e os
// rótulos de `source`/hash abreviado que ainda não existiam em nenhum
// lugar do projeto.

import { formatDataSufficiencyStatus, formatGreenScoreCategory } from "./predictionCenterFormatters.ts";
import type { DataSufficiencyStatus, GreenScoreCategory } from "./predictionCenterTypes.ts";
import type { PredictionRecordSource } from "./predictionApiClient.ts";

const KNOWN_GREEN_SCORE_CATEGORIES: readonly GreenScoreCategory[] = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"];
const KNOWN_DATA_SUFFICIENCY_STATUSES: readonly DataSufficiencyStatus[] = ["INSUFFICIENT", "LIMITED", "SUFFICIENT", "STRONG"];

function isKnown<T extends string>(value: string, known: readonly T[]): value is T {
  return (known as readonly string[]).includes(value);
}

/** `PredictionSummary.greenScoreCategory` chega como `string` bruto —
 * nunca confia cegamente nisso: se o valor não for uma categoria
 * conhecida, devolve o valor bruto em vez de quebrar a tela. */
export function formatPredictionGreenScoreCategory(value: string): string {
  return isKnown(value, KNOWN_GREEN_SCORE_CATEGORIES) ? formatGreenScoreCategory(value) : value;
}

/** Mesma defesa para `PredictionSummary.combinedStatus` — reaproveita
 * `formatDataSufficiencyStatus`, nunca duplica os rótulos. */
export function formatPredictionCombinedStatus(value: string): string {
  return isKnown(value, KNOWN_DATA_SUFFICIENCY_STATUSES) ? formatDataSufficiencyStatus(value) : value;
}

const SOURCE_LABELS: Record<PredictionRecordSource, string> = {
  fixture: "Fixture (demonstração)",
  real: "Real",
};

export function formatPredictionSource(source: PredictionRecordSource): string {
  return SOURCE_LABELS[source];
}

/** Rótulo de um lado do confronto sem nunca renderizar "null" — usa a
 * equipe virtual quando existir, caindo para o identificador do
 * jogador. Nunca inventa um nome de equipe. */
export function formatMatchParticipant(virtualTeam: string | null, playerId: string): string {
  return virtualTeam ?? playerId;
}

/** Abrevia um valor longo (`configurationHash`/`snapshotHash`) para
 * exibição — nunca corta um valor já curto o suficiente. */
export function formatHashShort(value: string, prefixLength = 8, suffixLength = 4): string {
  if (value.length <= prefixLength + suffixLength + 1) return value;
  return `${value.slice(0, prefixLength)}…${value.slice(-suffixLength)}`;
}
