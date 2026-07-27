// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Tipos compartilhados pelo Goal Distribution Engine. Nenhum tipo aqui
// depende do Prisma Client — o motor inteiro opera sobre os resultados já
// produzidos pelo Intelligence Engine (Fase 1.5), recebidos como entrada
// pelo chamador, mais (opcionalmente) o resultado 1X2 já calculado pelo
// Prediction Engine (Sprint 4.1) — apenas como contexto de passagem, nunca
// misturado ao cálculo desta sprint (ver `GoalDistributionRequest`).

import type { GoalsRates } from "../intelligence/GoalsEngine.ts";
import type { HeadToHeadResult } from "../intelligence/HeadToHeadEngine.ts";
import type {
  PlayerPredictionInputs,
  MatchOutcomePrediction,
  DataSufficiencyResult,
  DataSufficiencyStatus,
  FeatureAvailability,
} from "../prediction/index.ts";

// Reexportados por conveniência: consumidores deste módulo não precisam
// importar diretamente de `../prediction/index.ts` (ou de
// `../intelligence/HeadToHeadEngine.ts`) para os tipos abaixo, que são
// inteiramente reaproveitados (nunca redefinidos) desta sprint.
export type { DataSufficiencyResult, DataSufficiencyStatus, FeatureAvailability, HeadToHeadResult };

/** Clampa um valor numérico entre min e max. Cópia local intencional (não
 * importada de `../prediction/types.ts`, que não é parte da fachada
 * pública da Sprint 4.1) — mantém esta área isolada, como o próprio
 * `src/services/prediction/types.ts` fez para a Fase 1.5. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** true somente para números finitos (rejeita NaN, +Infinity, -Infinity e não-números). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Perfil estatístico de UM jogador para a estimativa de gols: estende
 * `PlayerPredictionInputs` (Sprint 4.1, reaproveitado sem alteração) com
 * `goalsRates` (Módulo 3, GoalsEngine). `goalsRates` é aceito por
 * completude e para uso em fases futuras (ex.: validação cruzada entre a
 * distribuição de Poisson calculada aqui e as taxas históricas de
 * Over/BTTS observadas) — ele NÃO influencia o cálculo de `expectedGoals`
 * nesta sprint, porque `over25`/`bothTeamsScored`/etc. são consequências
 * derivadas da mesma média de gols já capturada por
 * `form.last{5,10,20}.avgGoalsFor/avgGoalsAgainst` e por
 * `homeAway.{home,away}.avgGoalsFor/avgGoalsAgainst` — usá-lo agora
 * duplicaria sinal, não adicionaria informação independente genuína (ver
 * `docs/ESOCER_GOAL_DISTRIBUTION_ENGINE_PHASE_4_2.md`, Seção 7).
 */
export type GoalDistributionPlayerInputs = PlayerPredictionInputs & {
  goalsRates: GoalsRates | null;
};

/**
 * Requisição completa de distribuição de gols. `predictionContext` é
 * **opcional e nunca lido** por nenhum cálculo desta sprint — existe
 * apenas como um ponto de extensão para uma fase futura (Sprint 4.3) que
 * venha a comparar/calibrar os dois modelos lado a lado. Passar valores
 * diferentes de `predictionContext` para a mesma dupla de jogadores nunca
 * altera nenhum número desta previsão (testado explicitamente).
 */
export type GoalDistributionRequest = {
  homePlayer: GoalDistributionPlayerInputs;
  awayPlayer: GoalDistributionPlayerInputs;
  headToHead: HeadToHeadResult | null;
  predictionContext?: MatchOutcomePrediction;
};

/** Gols esperados (lambdas de Poisson) para mandante, visitante e total.
 * Sempre finitos e estritamente positivos (nunca zero absoluto). */
export type ExpectedGoals = {
  home: number;
  away: number;
  total: number;
};

/**
 * Rastro de UMA feature de gols. Ao contrário de `PredictionFeatureTrace`
 * (Sprint 4.1), cada feature aqui é bidirecional por natureza — produz
 * simultaneamente uma contribuição para o lado mandante e uma para o lado
 * visitante (ex.: a mesma feature `headToHead` informa quantos gols o
 * mandante costuma marcar E quantos o visitante costuma marcar nesse
 * confronto). Por isso `rawValue`/`normalizedValue` são sempre `null` —
 * não há um único valor bruto/normalizado que represente os dois lados ao
 * mesmo tempo; `contributionHome`/`contributionAway` carregam os valores
 * relevantes (mesma decisão de design já usada por `drawBalance` na
 * Sprint 4.1 para features compostas).
 */
export type GoalFeatureTrace = {
  name: string;
  rawValue: number | null;
  normalizedValue: number | null;
  weight: number;
  contributionHome: number;
  contributionAway: number;
  availability: FeatureAvailability;
  explanation: string;
};

export type PoissonProbability = {
  goals: number;
  probability: number;
};

export type ExactScoreProbability = {
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  probability: number;
};

export type GoalLineProbability = {
  line: number;
  over: number;
  under: number;
};

export type BothTeamsToScoreProbability = {
  yes: number;
  no: number;
};

export type ScoreDerivedOutcomeProbabilities = {
  homeWin: number;
  draw: number;
  awayWin: number;
};

/**
 * Saída pública do Goal Distribution Engine. `generatedAt` é informativo
 * apenas — nunca influencia o cálculo (injetado via parâmetro `now`, nunca
 * lido de `Date.now()`/relógio do sistema dentro da lógica matemática).
 * `scoreDerivedOutcomeProbabilities` é derivada apenas da matriz de
 * placares desta sprint — nunca combinada ou misturada com o resultado do
 * Prediction Engine (Sprint 4.1); serve exclusivamente para comparação e
 * validação cruzada futura. `warnings` (topo) carrega avisos de
 * comportamento do motor (ex.: fallback conservador aplicado) e nunca se
 * sobrepõe a `dataSufficiency.warnings` (avisos de classificação de
 * suficiência de amostra) — as duas listas são complementares, não
 * duplicadas.
 */
export type GoalDistributionPrediction = {
  modelVersion: string;
  generatedAt: string;
  expectedGoals: ExpectedGoals;
  homeGoalDistribution: PoissonProbability[];
  awayGoalDistribution: PoissonProbability[];
  exactScores: ExactScoreProbability[];
  mostLikelyScore: ExactScoreProbability;
  topExactScores: ExactScoreProbability[];
  topExactScoresAggregateProbability: number;
  overUnder: GoalLineProbability[];
  bothTeamsToScore: BothTeamsToScoreProbability;
  scoreDerivedOutcomeProbabilities: ScoreDerivedOutcomeProbabilities;
  dataSufficiency: DataSufficiencyResult;
  featureTrace: GoalFeatureTrace[];
  warnings: string[];
};
