export interface TeamStats {
  recentForm: number;
  goalsForAverage: number;
  goalsAgainstAverage: number;
  cornersAverage: number;
  shotsOnTargetAverage: number;
  expectedGoals?: number;
}

export async function getTeamStats(teamId: string): Promise<TeamStats> {
  void teamId;
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return { recentForm: 0.72, goalsForAverage: 1.8, goalsAgainstAverage: 0.9, cornersAverage: 5.6, shotsOnTargetAverage: 4.9, expectedGoals: 1.65 };
  }
  // Connect a licensed provider such as API-Football or SportMonks here.
  return { recentForm: 0.72, goalsForAverage: 1.8, goalsAgainstAverage: 0.9, cornersAverage: 5.6, shotsOnTargetAverage: 4.9, expectedGoals: 1.65 };
}
