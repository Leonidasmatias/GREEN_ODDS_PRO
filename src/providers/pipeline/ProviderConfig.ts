// Fase 2 — Data Ingestion Pipeline.
// ProviderConfig: permite selecionar, por configuração, qual provider de
// partidas está ativo (Fixture, BetsAPI, CSV ou Manual), sem que o
// restante do sistema precise saber qual foi escolhido — apenas o
// contrato MatchProvider é consumido a partir daqui em diante.
//
// CsvProvider e ManualProvider são implementações mínimas (mas reais e
// testadas) para completar as quatro opções pedidas pela missão. Ambas
// reaproveitam o mesmo shape "fixture-like" (id/league/scheduledAt/
// rawHomeName/rawAwayName/homePlayerId/awayPlayerId/status/homeScore/
// awayScore) já suportado pelo ProviderNormalizer para "CSV"/"MANUAL".

import { InMemoryMatchProviderBase } from "../base/InMemoryMatchProvider.ts";
import type { HealthProvider, MatchProvider, ProviderHealthStatus } from "../contracts/index.ts";
import type { ProviderName } from "../types/dto.ts";
import type { RawFixtureMatch } from "../fixture/esoccerFixtureCatalog.ts";
import { esoccerFixtureCatalog } from "../fixture/esoccerFixtureCatalog.ts";
import { FixtureProvider } from "../fixture/FixtureProvider.ts";
import { BetsApiAdapter, type BetsApiAdapterOptions } from "../betsapi/BetsApiAdapter.ts";
import type { CsvOrManualRawMatch } from "./ProviderNormalizer.ts";

const CSV_COLUMNS = [
  "id",
  "league",
  "scheduledAt",
  "rawHomeName",
  "rawAwayName",
  "homePlayerId",
  "awayPlayerId",
  "status",
  "homeScore",
  "awayScore",
] as const;

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * Parser mínimo de CSV: uma linha de cabeçalho seguida das linhas de
 * dados, colunas separadas por vírgula, sem suporte a vírgulas dentro de
 * campos (não necessário para este formato simulado e controlado).
 */
export function parseCsvMatches(csvContent: string): CsvOrManualRawMatch[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((column) => column.trim());
  for (const expected of CSV_COLUMNS) {
    if (!header.includes(expected)) {
      throw new CsvParseError(`Coluna obrigatória ausente no CSV: "${expected}".`);
    }
  }

  return lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(",").map((cell) => cell.trim());
    if (cells.length !== header.length) {
      throw new CsvParseError(`Linha ${rowIndex + 2} do CSV tem número de colunas inconsistente com o cabeçalho.`);
    }
    const row: Record<string, string> = {};
    header.forEach((column, index) => {
      row[column] = cells[index];
    });
    return {
      id: row.id,
      league: row.league,
      scheduledAt: row.scheduledAt,
      rawHomeName: row.rawHomeName,
      rawAwayName: row.rawAwayName,
      homePlayerId: row.homePlayerId,
      awayPlayerId: row.awayPlayerId,
      status: row.status as RawFixtureMatch["status"],
      homeScore: Number(row.homeScore),
      awayScore: Number(row.awayScore),
      provider: "CSV",
    };
  });
}

export class CsvProvider extends InMemoryMatchProviderBase<CsvOrManualRawMatch> implements MatchProvider<CsvOrManualRawMatch>, HealthProvider {
  readonly name: ProviderName = "CSV";

  constructor(csvContent: string) {
    super(parseCsvMatches(csvContent), {
      getExternalId: (record) => record.id,
      getScheduledAt: (record) => record.scheduledAt,
      getPlayerNicknames: (record) => [record.homePlayerId, record.awayPlayerId],
      getLeagueName: (record) => record.league,
    });
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    return {
      provider: this.name,
      healthy: true,
      lastSyncAt: new Date().toISOString(),
      averageResponseTimeMs: 2,
      lastError: null,
    };
  }
}

export class ManualProvider extends InMemoryMatchProviderBase<CsvOrManualRawMatch> implements MatchProvider<CsvOrManualRawMatch>, HealthProvider {
  readonly name: ProviderName = "MANUAL";

  constructor(records: CsvOrManualRawMatch[] = []) {
    super(
      records.map((record) => ({ ...record, provider: "MANUAL" as const })),
      {
        getExternalId: (record) => record.id,
        getScheduledAt: (record) => record.scheduledAt,
        getPlayerNicknames: (record) => [record.homePlayerId, record.awayPlayerId],
        getLeagueName: (record) => record.league,
      },
    );
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    return {
      provider: this.name,
      healthy: true,
      lastSyncAt: new Date().toISOString(),
      averageResponseTimeMs: 0,
      lastError: null,
    };
  }
}

export type ProviderConfigInput =
  | { selection: "FIXTURE"; fixtureRecords?: RawFixtureMatch[] }
  | { selection: "BETSAPI"; betsApiOptions: BetsApiAdapterOptions }
  | { selection: "CSV"; csvContent: string }
  | { selection: "MANUAL"; manualRecords?: CsvOrManualRawMatch[] };

/** Resolve, a partir da configuração, qual provider concreto usar — o restante do sistema só enxerga o contrato MatchProvider. */
export function resolveMatchProvider(config: ProviderConfigInput): MatchProvider<unknown> {
  switch (config.selection) {
    case "FIXTURE":
      return new FixtureProvider(config.fixtureRecords ?? esoccerFixtureCatalog);
    case "BETSAPI":
      return new BetsApiAdapter(config.betsApiOptions);
    case "CSV":
      return new CsvProvider(config.csvContent);
    case "MANUAL":
      return new ManualProvider(config.manualRecords ?? []);
    default: {
      const exhaustiveCheck: never = config;
      throw new Error(`Seleção de provider desconhecida: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
