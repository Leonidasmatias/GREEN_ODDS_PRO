#!/usr/bin/env node
// Fase 3 - BetsAPI Real Integration.
// Teste manual controlado - NAO e executado automaticamente por nenhum
// pipeline, CI, ou pelo assistente sem autorizacao explicita do usuario.
//
// Faz NO MAXIMO UMA chamada real (getUpcomingEvents, pagina 1), nunca
// persiste nada, nunca executa a Aggregation do Intelligence Engine, e
// nunca imprime o token - apenas um resumo sanitizado. Sai com codigo
// diferente de zero em qualquer falha (configuracao ausente, erro de
// rede, erro de autenticacao, etc.).
//
// Uso (exige autorizacao explicita do usuario para rodar):
//   BETSAPI_ENABLED=true BETSAPI_MODE=sandbox BETSAPI_TOKEN=xxxxx node scripts/betsapi-smoke-test.mjs

import { loadBetsApiConfig } from "../src/providers/betsapi/BetsApiConfig.ts";
import { BetsApiClient } from "../src/providers/betsapi/BetsApiClient.ts";
import { BetsApiError } from "../src/providers/betsapi/BetsApiErrors.ts";
import { redactDeep } from "../src/providers/betsapi/BetsApiRedaction.ts";

function fail(message) {
  console.error(`[betsapi-smoke-test] FALHA: ${message}`);
  process.exit(1);
}

async function main() {
  if (process.env.BETSAPI_ENABLED !== "true") {
    fail('este script exige BETSAPI_ENABLED=true explicitamente definido no ambiente.');
  }
  if (process.env.BETSAPI_MODE !== "sandbox") {
    fail('este script so roda com BETSAPI_MODE=sandbox (nunca "live" a partir daqui).');
  }
  if (!process.env.BETSAPI_TOKEN || process.env.BETSAPI_TOKEN.trim().length === 0) {
    fail("BETSAPI_TOKEN nao esta definido no ambiente.");
  }

  let config;
  try {
    config = loadBetsApiConfig(process.env);
  } catch (error) {
    fail(error instanceof BetsApiError ? error.safeMessage : "configuracao invalida.");
    return;
  }

  const client = new BetsApiClient(config);

  const startedAt = Date.now();
  try {
    // Unica chamada real permitida por esta execucao.
    const payload = await client.getUpcomingEvents({ sport_id: config.sportId, page: 1 });
    const latencyMs = Date.now() - startedAt;

    const summary = redactDeep({
      ok: true,
      mode: config.mode,
      sportId: config.sportId,
      endpoint: "/v3/events/upcoming",
      latencyMs,
      eventsReturned: payload.results.length,
      rateLimitRemaining: client.getRateLimitState()?.remaining ?? null,
    });

    console.log("[betsapi-smoke-test] OK - resumo sanitizado:");
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    const safeMessage = error instanceof BetsApiError ? error.safeMessage : "erro desconhecido ao chamar a BetsAPI.";
    console.error("[betsapi-smoke-test] FALHA na chamada real:");
    console.error(JSON.stringify(redactDeep({ ok: false, code: error?.code ?? null, safeMessage }), null, 2));
    process.exit(1);
  }
}

main();
