// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline, Fase 9.
// Testes puros para parseProviderSyncMetadata — usado tanto pelo health
// endpoint quanto pelo Dashboard para ler o metadata estruturado gravado
// em AuditLog (PROVIDER_SYNC).
import test from "node:test";
import assert from "node:assert/strict";
import { parseProviderSyncMetadata } from "../src/services/providerSyncMetadata.ts";

test("parseProviderSyncMetadata: parses well-formed JSON", () => {
  const raw = JSON.stringify({ provider: "the-odds-api", sport: "soccer_epl", league: "EPL", eventsFound: 10, oddsFound: 40 });
  const parsed = parseProviderSyncMetadata(raw);
  assert.equal(parsed.provider, "the-odds-api");
  assert.equal(parsed.sport, "soccer_epl");
  assert.equal(parsed.eventsFound, 10);
});

test("parseProviderSyncMetadata: returns null for null/undefined input, never throws", () => {
  assert.equal(parseProviderSyncMetadata(null), null);
  assert.equal(parseProviderSyncMetadata(undefined), null);
});

test("parseProviderSyncMetadata: returns null for malformed JSON, never throws", () => {
  assert.equal(parseProviderSyncMetadata("{not valid json"), null);
});

test("parseProviderSyncMetadata: returns null for an empty string", () => {
  assert.equal(parseProviderSyncMetadata(""), null);
});
