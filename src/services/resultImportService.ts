import { syncFinishedMatches } from "./resultCollectorEngine";

export async function importResultsAndSettle() {
  const sync = await syncFinishedMatches();
  return {
    scoresReceived: sync.resultsReceived,
    matchesUpdated: sync.matchesUpdated,
    settlement: sync.settlement,
    provider: sync.provider,
    warning: sync.warning,
  };
}
