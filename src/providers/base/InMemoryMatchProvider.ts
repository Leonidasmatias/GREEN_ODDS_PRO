// Fase 2 — Data Ingestion Pipeline.
// Base compartilhada para providers cujos dados residem inteiramente em
// memória nesta fase (Fixture, CSV, Manual e o BetsAPI simulado, já que
// "não consumir internet" é uma restrição desta fase). Implementa uma vez
// só os métodos de conveniência (getMatch/listMatchesByPeriod/
// listMatchesByPlayer/listMatchesByLeague) do contrato MatchProvider, a
// partir de funções de acesso (`accessors`) fornecidas por cada provider
// concreto para o seu próprio formato bruto (TRaw).

export type InMemoryMatchAccessors<TRaw> = {
  getExternalId: (raw: TRaw) => string;
  getScheduledAt: (raw: TRaw) => string;
  getPlayerNicknames: (raw: TRaw) => [string, string];
  getLeagueName: (raw: TRaw) => string;
};

export abstract class InMemoryMatchProviderBase<TRaw> {
  protected readonly records: TRaw[];
  private readonly accessors: InMemoryMatchAccessors<TRaw>;

  protected constructor(records: TRaw[], accessors: InMemoryMatchAccessors<TRaw>) {
    this.records = records;
    this.accessors = accessors;
  }

  async listMatches(): Promise<TRaw[]> {
    return [...this.records];
  }

  async getMatch(externalId: string): Promise<TRaw | null> {
    return this.records.find((record) => this.accessors.getExternalId(record) === externalId) ?? null;
  }

  async listMatchesByPeriod(fromISO: string, toISO: string): Promise<TRaw[]> {
    const from = new Date(fromISO).getTime();
    const to = new Date(toISO).getTime();
    return this.records.filter((record) => {
      const scheduledAt = new Date(this.accessors.getScheduledAt(record)).getTime();
      return scheduledAt >= from && scheduledAt <= to;
    });
  }

  async listMatchesByPlayer(playerNickname: string): Promise<TRaw[]> {
    const target = playerNickname.trim().toLowerCase();
    return this.records.filter((record) => {
      const [home, away] = this.accessors.getPlayerNicknames(record);
      return home.trim().toLowerCase() === target || away.trim().toLowerCase() === target;
    });
  }

  async listMatchesByLeague(leagueName: string): Promise<TRaw[]> {
    const target = leagueName.trim().toLowerCase();
    return this.records.filter((record) => this.accessors.getLeagueName(record).trim().toLowerCase() === target);
  }
}
