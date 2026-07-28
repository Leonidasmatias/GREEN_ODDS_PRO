// Sprint 8.3 — Production Persistence.
// Script auxiliar de validação: importa o composition root real
// (`predictionCenterComposition.ts`) em um processo `node` isolado e
// imprime o resultado de `health()` do Repository efetivamente
// escolhido. Rodado com diferentes combinações de `NODE_ENV`/
// `DATABASE_URL` por `tests/predictionCenterComposition.test.mjs` para
// provar, por processo real (não por mock), que a seleção
// development/test/production nunca depende de acaso.
import { predictionCenterApplication } from "../../src/services/predictionCenterComposition.ts";

try {
  const health = await predictionCenterApplication.queryService.health();
  process.stdout.write(JSON.stringify(health));
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
