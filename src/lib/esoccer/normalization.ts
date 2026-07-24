// Fase 1 — Fundação do domínio eSoccer.
// Utilitários de normalização usados para transformar nicknames de jogador e
// nomes de equipe virtual em chaves de comparação estáveis. Não implementa
// fuzzy matching: dois nicknames parecidos nunca são tratados como o mesmo
// jogador nesta fase.

export class ESoccerNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ESoccerNormalizationError";
  }
}

function normalizeCore(value: string, label: string): string {
  if (typeof value !== "string") {
    throw new ESoccerNormalizationError(`${label} deve ser uma string.`);
  }
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (normalized.length === 0) {
    throw new ESoccerNormalizationError(`${label} não pode ser vazio após normalização.`);
  }
  return normalized;
}

/**
 * Normaliza o nickname de um jogador de eSoccer para uma chave de comparação
 * estável: aplica trim, Unicode NFKC, colapsa espaços internos múltiplos em
 * um único espaço e converte para lowercase. Números, hífens, underscores e
 * pontos são preservados. Determinístico: a mesma entrada sempre produz a
 * mesma saída.
 */
export function normalizeESoccerNickname(value: string): string {
  return normalizeCore(value, "Nickname do jogador");
}

/**
 * Normaliza o nome de uma equipe virtual (clube/seleção usado na partida).
 * Segue exatamente as mesmas regras de normalizeESoccerNickname — a equipe
 * virtual não é a identidade permanente do jogador, mas ainda precisa de uma
 * chave de comparação estável para deduplicação de ligas/times.
 */
export function normalizeVirtualTeamName(value: string): string {
  return normalizeCore(value, "Nome da equipe virtual");
}

/**
 * Ordena um par de identificadores (nicknames normalizados ou IDs numéricos)
 * de forma canônica e determinística: o menor valor sempre ocupa a primeira
 * posição. Usado para persistir estatísticas de confronto direto (H2H) sem
 * depender da ordem casa/visitante de uma partida específica. Não rejeita
 * pares iguais — a regra de "jogador não pode enfrentar ele mesmo" é
 * responsabilidade da camada de validação de domínio
 * (src/services/esoccerDomainService.ts), não desta função de ordenação pura.
 */
export function canonicalizePlayerPair<T extends string | number>(first: T, second: T): [T, T] {
  return first <= second ? [first, second] : [second, first];
}
