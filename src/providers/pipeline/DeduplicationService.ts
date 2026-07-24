// Fase 2 — Data Ingestion Pipeline.
// DeduplicationService: evita duplicidade de partidas ao longo de
// execuções sucessivas da Pipeline.
//
// ESTRATÉGIA (documentada conforme exigido pela missão):
//   1. Chave primária: `${provider}::${externalId}` — quando o provider
//      fornece um externalId estável (caso normal de BetsAPI/Fixture/CSV
//      com id), esta é a chave de identidade da partida.
//   2. Chave secundária (fallback): quando não há externalId, a chave
//      passa a ser `${provider}::${hash de conteúdo}`, onde o hash é
//      calculado sobre jogadores + scheduledAt (timestamp) + placar, para
//      que duas submissões do mesmo confronto no mesmo horário colidam
//      mesmo sem id.
//   3. Para cada chave já vista, um hash de conteúdo (jogadores +
//      scheduledAt + status + placar) é comparado ao hash anterior:
//        - hash igual      -> DUPLICATE (ignorar, nada mudou)
//        - hash diferente  -> UPDATED (mesma identidade, dado novo — ex.:
//                              placar que chegou depois que a partida
//                              terminou)
//        - chave inédita   -> NEW
//   O hash de conteúdo é um hash simples determinístico (soma
//   polinomial em base 31), sem nenhuma biblioteca externa — não precisa
//   ser criptograficamente forte, apenas estável e sensível a mudanças.

import type { InternalMatchDTO } from "../types/dto.ts";

export type DedupOutcome = "NEW" | "DUPLICATE" | "UPDATED";

type DedupEntry = { hash: string };

function contentHash(match: InternalMatchDTO): string {
  const raw = [
    match.provider,
    match.home.player.normalizedNickname,
    match.away.player.normalizedNickname,
    match.scheduledAt,
    match.status,
    String(match.homeScore),
    String(match.awayScore),
  ].join("|");

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function identityKey(match: InternalMatchDTO): string {
  if (match.externalId && match.externalId.trim().length > 0) {
    return `${match.provider}::${match.externalId}`;
  }
  return `${match.provider}::hash::${contentHash(match)}`;
}

export class DeduplicationService {
  private readonly seen = new Map<string, DedupEntry>();

  /** Avalia (e registra) uma partida normalizada; ver estratégia documentada acima. */
  evaluate(match: InternalMatchDTO): DedupOutcome {
    const key = identityKey(match);
    const hash = contentHash(match);
    const existing = this.seen.get(key);

    if (!existing) {
      this.seen.set(key, { hash });
      return "NEW";
    }
    if (existing.hash === hash) {
      return "DUPLICATE";
    }
    this.seen.set(key, { hash });
    return "UPDATED";
  }

  size(): number {
    return this.seen.size;
  }

  clear(): void {
    this.seen.clear();
  }
}
