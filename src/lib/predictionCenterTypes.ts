// Sprint 6.5 — Prediction Center.
// Tipos de apresentação do Prediction Center. Seguem exatamente o mesmo
// padrão já aprovado na Sprint 6.0 (`intelligenceTypes.ts`): enums
// reaproveitados por `import type` diretamente das fachadas públicas dos
// motores (nunca redefinidos à mão), e apenas os tipos genuinamente novos
// de apresentação (view model, códigos de mercado, nível de risco) são
// declarados aqui.

// Import relativo (não `@/`) — este arquivo é 100% tipos (apagado em
// tempo de execução), mas mantido consistente com os demais arquivos de
// lógica pura desta feature, que precisam ser executáveis também por
// `node --test` (sem bundler, sem resolução do alias `@/`).
import type {
  ConsistencyLevel,
  DataSufficiencyStatus,
  GreenScoreCategory,
  MatchOutcome,
  PredictionSignalFavors,
  PredictionSignalSource,
  PredictionSignalType,
} from "../services/prediction-orchestrator/index.ts";
import type { PredictionSnapshot } from "../services/prediction-evaluation/index.ts";

export type { PredictionSnapshot };

/** "fixture" enquanto não existir persistência/ingestão real produzindo
 * `PredictionSnapshot`s (Sprint 6.5) — nunca apresentado como dado ao
 * vivo. Mesmo padrão de `IntelligenceSourceKind` (Sprint 6.0), declarado
 * de forma independente porque as duas features são independentes entre
 * si (nenhuma reexporta tipos da outra). */
export type PredictionCenterSourceKind = "real" | "fixture";

/**
 * Mercados exibidos no Prediction Center — exatamente os campos pedidos
 * pelo objetivo da sprint (1X2, Over 1.5, Over 2.5, BTTS). Não é um
 * conceito que exista em nenhum motor: é puramente de apresentação,
 * mapeando cada código para o campo já calculado que ele representa
 * (nunca uma probabilidade recalculada).
 */
export type MarketCode = "HOME_WIN" | "DRAW" | "AWAY_WIN" | "OVER_1_5" | "OVER_2_5" | "BTTS";

/**
 * Nível de risco por partida — categorização puramente presentacional
 * (nunca um novo cálculo estatístico) derivada de `quality`/`warnings`
 * já produzidos pelo Prediction Orchestrator. Distinto do `RiskLevel`
 * por PERFIL agregado da Observability (Sprint 5.3) — os dois conceitos
 * não são intercambiáveis e não se cruzam nesta sprint (decisão
 * arquitetural confirmada).
 */
export type PredictionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "ELEVATED";

/**
 * Motivo estruturado (nunca texto livre) que contribuiu para o nível de
 * risco — traduzido para texto exclusivamente por
 * `predictionCenterFormatters.ts`. Mantém `predictionMarketUtils.ts`
 * inteiramente livre de string em português, mesma separação já usada
 * entre motores e `intelligenceFormatters.ts` na Sprint 6.0.
 */
export type PredictionRiskReasonCode =
  | "LIMITED_DATA_SUFFICIENCY"
  | "INSUFFICIENT_DATA_SUFFICIENCY"
  | "MINOR_ENGINE_DIVERGENCE"
  | "MAJOR_ENGINE_DIVERGENCE"
  | "ENGINE_WARNINGS_PRESENT";

/** Estado de degradação de UM item — nunca decidido pelo componente,
 * sempre calculado a partir da mesma classificação de risco usada por
 * `risk` (rank 0 = "success", rank > 0 = "partial"). */
export type PredictionCenterItemStatus = "success" | "partial";

export type MarketViewModel = {
  code: MarketCode;
  label: string;
  probabilityLabel: string;
  probabilityValue: number | null;
};

export type SignalViewModel = {
  typeLabel: string;
  sourceLabel: string;
  favorsLabel: string;
  magnitudeLabel: string;
};

export type PredictionCenterHeaderViewModel = {
  matchId: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  leagueLabel: string;
  modelVersion: string;
  generatedAtLabel: string;
};

export type PredictionCenterScoresViewModel = {
  greenScore: number;
  greenScoreCategory: GreenScoreCategory;
  greenScoreLabel: string;
  greenScoreCategoryLabel: string;
  confidence: number;
  confidenceLabel: string;
};

export type PredictionCenterOutcomeViewModel = {
  predictedOutcome: MatchOutcome;
  predictedOutcomeLabel: string;
  probabilities: { homeWin: string; draw: string; awayWin: string };
  topProbabilityLabel: string;
  marginLabel: string;
};

export type PredictionCenterPredictedScoreViewModel = {
  homeGoals: number;
  awayGoals: number;
  probabilityLabel: string;
};

export type PredictionCenterConfidenceContextViewModel = {
  dataSufficiencyLabel: string;
  consistencyLabel: string;
  consistencyMatchingWinner: boolean;
};

export type PredictionCenterRiskViewModel = {
  level: PredictionRiskLevel;
  label: string;
  reasons: string[];
};

export type PredictionCenterExplanationViewModel = {
  topSignals: SignalViewModel[];
  totalSignalsConsidered: number;
};

export type PredictionCenterViewModel = {
  header: PredictionCenterHeaderViewModel;
  scores: PredictionCenterScoresViewModel;
  outcome: PredictionCenterOutcomeViewModel;
  predictedScore: PredictionCenterPredictedScoreViewModel;
  markets: MarketViewModel[];
  bestMarket: MarketViewModel | null;
  confidenceContext: PredictionCenterConfidenceContextViewModel;
  risk: PredictionCenterRiskViewModel;
  explanation: PredictionCenterExplanationViewModel;
  warnings: string[];
  status: PredictionCenterItemStatus;
};

/**
 * Resultado tipado do `predictionCenterService`. `status` no nível
 * superior é sempre um rollup determinístico dos `status` individuais de
 * `items` (ver `rollupItemsStatus` em `predictionMarketUtils.ts`) —
 * nunca uma decisão nova, apenas o pior caso entre os itens do lote.
 *
 * Sprint 8.1: este resultado é produzido exclusivamente por uma
 * operação de LEITURA (`getPredictionCenterData`) — nunca persiste.
 * O campo `persistence` que existia aqui na Sprint 8.0 foi removido: uma
 * operação de leitura não tem mais nenhum efeito de escrita associado
 * para resumir (geração+persistência explícita agora é um caso de uso
 * próprio, `generateAndPersistPredictionCenterData`, com seu próprio
 * contrato de retorno). `page.tsx` nunca leu esse campo, então a
 * remoção é invisível ao comportamento visual existente.
 */
export type PredictionCenterDataResult =
  | { status: "success" | "partial"; source: PredictionCenterSourceKind; items: PredictionCenterViewModel[] }
  | { status: "empty"; source: PredictionCenterSourceKind }
  | { status: "error"; message: string };

// Reexportados por conveniência: consumidores deste módulo (adapter,
// componentes) não precisam importar diretamente das fachadas dos
// motores para estes conceitos, inteiramente reaproveitados (nunca
// redefinidos) desta sprint.
export type { ConsistencyLevel, DataSufficiencyStatus, GreenScoreCategory, MatchOutcome, PredictionSignalFavors, PredictionSignalSource, PredictionSignalType };
