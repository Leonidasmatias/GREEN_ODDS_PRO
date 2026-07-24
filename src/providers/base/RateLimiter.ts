// Fase 2 — Data Ingestion Pipeline.
// Rate limiter abstrato (janela deslizante simples). A função `now` é
// injetável para permitir testes 100% determinísticos, sem depender do
// relógio real do sistema nem de temporizadores.

export type RateLimiterConfig = {
  maxRequests: number;
  windowMs: number;
};

export class AbstractRateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly now: () => number;
  private timestamps: number[] = [];

  constructor(config: RateLimiterConfig, now: () => number = () => Date.now()) {
    this.config = config;
    this.now = now;
  }

  /** Tenta consumir uma unidade da cota; devolve false se o limite da janela já foi atingido. */
  tryAcquire(): boolean {
    const nowMs = this.now();
    this.timestamps = this.timestamps.filter((timestamp) => nowMs - timestamp < this.config.windowMs);
    if (this.timestamps.length >= this.config.maxRequests) {
      return false;
    }
    this.timestamps.push(nowMs);
    return true;
  }

  remaining(): number {
    return Math.max(0, this.config.maxRequests - this.timestamps.length);
  }
}
