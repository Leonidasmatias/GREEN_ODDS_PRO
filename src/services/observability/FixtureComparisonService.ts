// Fase 3.5 - Observabilidade e Validacao em Producao.
// FixtureComparisonService: compara a ESTRUTURA (conjunto de chaves e
// tipos primitivos por chave) de InternalMatchDTO vindos de eventos reais
// da BetsAPI (Fase 3) contra InternalMatchDTO vindos do FixtureProvider
// (Fase 2, 300 partidas simuladas) - ambos ja passaram pelo mesmo
// ProviderNormalizer, entao divergencia estrutural indica que o payload
// real mudou de formato de um jeito que a normalizacao nao previu.
//
// REGRAS OBRIGATORIAS:
//   - NUNCA compara valores de identificadores (externalId, nicknames,
//     nomes de liga) literalmente - apenas presenca de chave e tipo.
//   - NUNCA gera recomendacao de aposta - o resultado e puramente
//     estrutural (drift de schema), usado apenas para alertas de
//     observabilidade (ver AlertRuleEngine, FIXTURE_STRUCTURAL_DRIFT).

import type { FixtureComparisonResult } from "./types.ts";

function primitiveType(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function collectShape(value: unknown, path: string, shape: Map<string, string>): void {
  const type = primitiveType(value);
  if (type === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectShape(child, path ? `${path}.${key}` : key, shape);
    }
    return;
  }
  shape.set(path || "(root)", type);
}

function collectUnionShape(records: unknown[]): Map<string, Set<string>> {
  const union = new Map<string, Set<string>>();
  for (const record of records) {
    const shape = new Map<string, string>();
    collectShape(record, "", shape);
    for (const [path, type] of shape) {
      if (!union.has(path)) union.set(path, new Set());
      union.get(path)!.add(type);
    }
  }
  return union;
}

/**
 * Compara a uniao das formas estruturais de duas amostras (tipicamente
 * live=eventos reais convertidos, fixture=amostra do FixtureProvider).
 * Campos nulos em uma amostra e nao-nulos em outra nao sao tratados como
 * incompatibilidade de tipo (nulidade e esperada para campos opcionais
 * como placar antes do fim da partida).
 */
export function compareFixtureStructure(
  liveRecords: unknown[],
  fixtureRecords: unknown[],
  now: () => Date = () => new Date(),
): FixtureComparisonResult {
  const liveShape = collectUnionShape(liveRecords);
  const fixtureShape = collectUnionShape(fixtureRecords);

  const missingInLive: string[] = [];
  const missingInFixture: string[] = [];
  const typeMismatches: string[] = [];

  for (const [path, fixtureTypes] of fixtureShape) {
    const liveTypes = liveShape.get(path);
    if (!liveTypes) {
      missingInLive.push(path);
      continue;
    }
    const fixtureNonNull = [...fixtureTypes].filter((type) => type !== "null");
    const liveNonNull = [...liveTypes].filter((type) => type !== "null");
    if (fixtureNonNull.length > 0 && liveNonNull.length > 0) {
      const compatible = fixtureNonNull.some((type) => liveNonNull.includes(type));
      if (!compatible) {
        typeMismatches.push(`${path}: fixture=[${fixtureNonNull.join(",")}] live=[${liveNonNull.join(",")}]`);
      }
    }
  }

  for (const path of liveShape.keys()) {
    if (!fixtureShape.has(path)) missingInFixture.push(path);
  }

  return {
    comparedAt: now().toISOString(),
    liveFieldCount: liveShape.size,
    fixtureFieldCount: fixtureShape.size,
    missingInLive,
    missingInFixture,
    typeMismatches,
    structurallyEquivalent: missingInLive.length === 0 && missingInFixture.length === 0 && typeMismatches.length === 0,
  };
}
