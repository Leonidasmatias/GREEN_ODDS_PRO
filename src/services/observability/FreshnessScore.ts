// Fase 3.5 - Correcao do DataQualityEngine (auditoria pos-implementacao).
// FreshnessScore: mede o quao recente e a ultima sincronizacao
// bem-sucedida (SyncRun.status === "success", ver SyncRunTracker.ts) numa
// escala 0..100. Calculo puro e deterministico - depende apenas do
// timestamp informado, do relogio injetavel `now` e do limiar configurado
// (OBSERVABILITY_STALE_DATA_MINUTES). Nenhuma chamada de rede, nenhum
// acesso a BetsAPI.
//
// REGRAS (conforme especificado pelo usuario nesta correcao):
//   - sem timestamp utilizavel (null ou nao parseavel)         -> 0
//   - idade <= staleDataMinutes ("janela fresca")               -> 100
//   - idade entre staleDataMinutes e FRESHNESS_ZERO_MULTIPLIER
//     vezes staleDataMinutes                                    -> decaimento LINEAR de 100 a 0
//   - idade >= FRESHNESS_ZERO_MULTIPLIER x staleDataMinutes      -> 0
//
// FRESHNESS_ZERO_MULTIPLIER e uma constante PROVISORIA (nao exposta por
// variavel de ambiente, para nao inflar ainda mais o orcamento de
// configuracao) - documentada em
// docs/OBSERVABILITY_AND_PRODUCTION_VALIDATION.md.

/** Apos quantas vezes staleDataMinutes o score de frescor chega a exatamente 0. PROVISORIO. */
export const FRESHNESS_ZERO_MULTIPLIER = 10;

/**
 * Computa o FreshnessScore (0..100) a partir do timestamp ISO da ultima
 * sincronizacao bem-sucedida. `now` e injetavel para calculo 100%
 * deterministico em testes.
 */
export function computeFreshnessScore(
  lastSuccessfulSyncAt: string | null,
  now: () => Date = () => new Date(),
  staleDataMinutes: number,
): number {
  if (!lastSuccessfulSyncAt) return 0;

  const referenceMs = Date.parse(lastSuccessfulSyncAt);
  if (!Number.isFinite(referenceMs)) return 0;

  const ageMinutes = (now().getTime() - referenceMs) / 60_000;

  if (ageMinutes <= staleDataMinutes) return 100;

  const zeroAtMinutes = staleDataMinutes * FRESHNESS_ZERO_MULTIPLIER;
  if (ageMinutes >= zeroAtMinutes) return 0;

  const decayWindowMinutes = zeroAtMinutes - staleDataMinutes;
  const overageMinutes = ageMinutes - staleDataMinutes;
  return 100 * (1 - overageMinutes / decayWindowMinutes);
}
