// Fase 1 — Fundação do domínio eSoccer.
// Validações puras de domínio para partidas, placares, probabilidades e
// classificação provisória de confiança. Nenhuma função aqui acessa o banco
// de dados ou qualquer serviço externo — são regras de negócio isoladas e
// testáveis sem dependência de Prisma, rede ou credenciais.
//
// IMPORTANTE: os limiares de classifyRecommendationStatus são PROVISÓRIOS
// e serão recalibrados após backtests reais com dados de eSoccer (ver
// docs/ESOCER_DOMAIN_V1.md, seção 11).

export class ESoccerDomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ESoccerDomainValidationError";
  }
}

const PROBABILITY_TOLERANCE = 0.0001;
const FINISHED_STATUS = "FINISHED";

function isValidScoreValue(score: number): boolean {
  return typeof score === "number" && Number.isInteger(score) && score >= 0;
}

/**
 * Garante que os dois lados de uma partida não sejam o mesmo jogador
 * (identidade = nickname normalizado) e que nenhum dos dois esteja vazio.
 * A equipe virtual não entra nesta validação: o mesmo jogador pode usar
 * equipes virtuais diferentes em partidas diferentes, e duas equipes
 * virtuais iguais não implicam o mesmo jogador.
 */
export function validateMatchParticipants(homeNormalizedNickname: string, awayNormalizedNickname: string): void {
  if (typeof homeNormalizedNickname !== "string" || homeNormalizedNickname.trim().length === 0) {
    throw new ESoccerDomainValidationError("Nickname normalizado do jogador da casa não pode ser vazio.");
  }
  if (typeof awayNormalizedNickname !== "string" || awayNormalizedNickname.trim().length === 0) {
    throw new ESoccerDomainValidationError("Nickname normalizado do jogador visitante não pode ser vazio.");
  }
  if (homeNormalizedNickname === awayNormalizedNickname) {
    throw new ESoccerDomainValidationError(
      "Um jogador não pode enfrentar ele mesmo (mesmo nickname normalizado nos dois lados).",
    );
  }
}

/**
 * Valida placares de partida. Placares, quando presentes, devem ser
 * inteiros não negativos. Quando o status for FINISHED, ambos os placares
 * são obrigatórios. Para qualquer outro status os placares podem estar
 * ausentes (null/undefined) — mas se estiverem presentes, ainda precisam
 * ser válidos.
 */
export function validateFinishedScore(
  status: string,
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
): void {
  const homeProvided = homeScore !== null && homeScore !== undefined;
  const awayProvided = awayScore !== null && awayScore !== undefined;

  if (status === FINISHED_STATUS && (!homeProvided || !awayProvided)) {
    throw new ESoccerDomainValidationError("Partida finalizada precisa de placar da casa e do visitante.");
  }
  if (homeProvided && !isValidScoreValue(homeScore as number)) {
    throw new ESoccerDomainValidationError("Placar da casa deve ser um inteiro não negativo.");
  }
  if (awayProvided && !isValidScoreValue(awayScore as number)) {
    throw new ESoccerDomainValidationError("Placar do visitante deve ser um inteiro não negativo.");
  }
}

export type ESoccerPredictionProbabilities = {
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
};

/**
 * Valida a tripla de probabilidades de uma previsão: cada valor precisa ser
 * finito e estar entre 0 e 1, e a soma das três precisa ser aproximadamente
 * 1 (tolerância máxima de 0.0001, para absorver erro de arredondamento de
 * ponto flutuante sem mascarar somas realmente inválidas).
 */
export function validatePredictionProbabilities(input: ESoccerPredictionProbabilities): void {
  const values = [input.homeWinProbability, input.drawProbability, input.awayWinProbability];
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ESoccerDomainValidationError("Probabilidades devem ser números finitos.");
    }
    if (value < 0 || value > 1) {
      throw new ESoccerDomainValidationError("Cada probabilidade deve estar entre 0 e 1.");
    }
  }
  const sum = values[0] + values[1] + values[2];
  if (Math.abs(sum - 1) > PROBABILITY_TOLERANCE) {
    throw new ESoccerDomainValidationError(
      `Soma das probabilidades deve ser aproximadamente 1 (tolerância ${PROBABILITY_TOLERANCE}); valor calculado: ${sum}.`,
    );
  }
}

export type ESoccerRecommendationStatusValue = "APPROVED" | "OBSERVATION" | "NO_BET";

/**
 * Classifica uma recomendação provisória a partir do confidenceScore (0–100):
 *   0–49   -> NO_BET
 *   50–69  -> OBSERVATION
 *   70–100 -> APPROVED
 * PROVISÓRIO: estes limiares serão recalibrados após backtests reais de
 * eSoccer. Esta fase não gera recomendações produtivas.
 */
export function classifyRecommendationStatus(confidenceScore: number): ESoccerRecommendationStatusValue {
  if (typeof confidenceScore !== "number" || !Number.isFinite(confidenceScore)) {
    throw new ESoccerDomainValidationError("Confidence score deve ser um número finito.");
  }
  if (confidenceScore < 0 || confidenceScore > 100) {
    throw new ESoccerDomainValidationError("Confidence score deve estar entre 0 e 100.");
  }
  if (confidenceScore >= 70) return "APPROVED";
  if (confidenceScore >= 50) return "OBSERVATION";
  return "NO_BET";
}
