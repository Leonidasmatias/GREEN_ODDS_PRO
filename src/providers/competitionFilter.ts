import type { ProviderMatch } from "./types";

export function matchesCompetitionFilter(competition: string) {
  const filter = (process.env.COMPETITION_FILTER?.trim() || "ALL").toUpperCase();
  const value = competition.toUpperCase();
  if (filter === "ALL") return true;
  if (filter === "WORLD_CUP") return value.includes("WORLD CUP") && !value.includes("QUALIF");
  if (filter === "QUALIFIERS") return value.includes("QUALIF") || value.includes("ELIMINAT");
  return value.includes(filter);
}

export function filterMatches(matches: ProviderMatch[]) {
  return matches.filter((match) => matchesCompetitionFilter(match.competition));
}
