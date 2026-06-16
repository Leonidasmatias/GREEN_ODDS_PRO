export interface ProviderTeamStats {
  form?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  corners?: number;
  shotsOnTarget?: number;
  expectedGoals?: number;
  sampleSize?: number;
}

export interface NormalizedTeamStats {
  recentForm: number;
  goalsForAverage: number;
  goalsAgainstAverage: number;
  cornersAverage: number;
  shotsOnTargetAverage: number;
  expectedGoals?: number;
  reliability: number;
}

const safeNumber = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? Number(value) : fallback;

export function normalizeTeamStats(stats: ProviderTeamStats): NormalizedTeamStats {
  const sampleSize = Math.max(0, safeNumber(stats.sampleSize));
  return {
    recentForm: Math.max(0, Math.min(1, safeNumber(stats.form, 0.5))),
    goalsForAverage: safeNumber(stats.goalsFor),
    goalsAgainstAverage: safeNumber(stats.goalsAgainst),
    cornersAverage: safeNumber(stats.corners),
    shotsOnTargetAverage: safeNumber(stats.shotsOnTarget),
    expectedGoals: stats.expectedGoals === undefined ? undefined : safeNumber(stats.expectedGoals),
    reliability: Math.min(1, sampleSize / 10),
  };
}
