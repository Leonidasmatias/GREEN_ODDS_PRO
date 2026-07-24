// Fase 2 — Data Ingestion Pipeline.
// ProviderHealthService: consulta o health check de um ou mais providers
// que implementem o contrato HealthProvider e devolve status, última
// sincronização, tempo médio de resposta, último erro e provider ativo.

import type { HealthProvider, ProviderHealthStatus } from "../contracts/index.ts";
import type { ProviderName } from "../types/dto.ts";

export class ProviderHealthService {
  private readonly providers: HealthProvider[];
  private activeProvider: ProviderName | null;

  constructor(providers: HealthProvider[], activeProvider: ProviderName | null = providers[0]?.name ?? null) {
    this.providers = providers;
    this.activeProvider = activeProvider;
  }

  setActiveProvider(providerName: ProviderName): void {
    this.activeProvider = providerName;
  }

  getActiveProvider(): ProviderName | null {
    return this.activeProvider;
  }

  async checkAll(): Promise<ProviderHealthStatus[]> {
    return Promise.all(this.providers.map((provider) => provider.checkHealth()));
  }

  async checkOne(providerName: ProviderName): Promise<ProviderHealthStatus | null> {
    const provider = this.providers.find((candidate) => candidate.name === providerName);
    if (!provider) return null;
    return provider.checkHealth();
  }

  async checkActive(): Promise<ProviderHealthStatus | null> {
    if (!this.activeProvider) return null;
    return this.checkOne(this.activeProvider);
  }
}
