import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const economyService = readFileSync("src/services/providerEconomyService.ts", "utf8");
const oddsService = readFileSync("src/services/oddsApi.ts", "utf8");

test("provider economy limits are enforced by source rules", () => {
  assert.match(economyService, /const DAILY_LIMIT = 10/);
  assert.match(economyService, /const HOURLY_LIMIT = 2/);
  assert.match(economyService, /PROVIDER_DAILY_LIMIT_REACHED/);
});

test("dashboard odds feed reads persisted data before provider in economy mode", () => {
  assert.match(oddsService, /isProviderEconomyMode\(\)/);
  assert.match(oddsService, /getPersistedOddsFeed/);
  const liveFunction = oddsService.slice(oddsService.indexOf("export async function getWorldCupOdds"));
  assert.ok(liveFunction.indexOf("getPersistedOddsFeed") < liveFunction.indexOf("getProviderLiveFeed"));
});
