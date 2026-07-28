// Sprint 8.3 — Production Persistence.
// Script auxiliar de validação (nunca chamado em produção): persiste UM
// registro conhecido via `PrismaPredictionRepository`, usando um
// `PrismaClient` PRÓPRIO deste processo (nunca o singleton de
// `lib/prisma.ts`), e sai. Chamado como um processo `node` totalmente
// separado por `tests/predictionPersistenceIntegration.test.mjs` para
// provar persistência real entre processos (equivalente a um restart da
// aplicação) — nunca dentro do mesmo processo do teste.
import { PrismaClient } from "@prisma/client";
import { PrismaPredictionRepository } from "../../src/repositories/prediction/PrismaPredictionRepository.ts";
import { computePredictionSnapshotHash } from "../../src/repositories/prediction/PredictionRepository.ts";
import { buildRestartCheckSnapshot } from "./fixture.mjs";

const runId = process.argv[2];
if (!runId) {
  console.error("usage: persist.mjs <runId>");
  process.exit(1);
}

const client = new PrismaClient();
const repository = new PrismaPredictionRepository(client);

const snapshot = buildRestartCheckSnapshot(runId);
const draft = {
  snapshotHash: computePredictionSnapshotHash(snapshot),
  schemaVersion: "1.0",
  modelVersion: snapshot.result.metadata.orchestratorModelVersion,
  configurationHash: snapshot.result.metadata.configurationHash,
  source: "fixture",
  snapshot,
};

try {
  const record = await repository.save(draft);
  process.stdout.write(JSON.stringify({ id: record.id, matchId: snapshot.matchId, snapshotHash: record.snapshotHash }));
} finally {
  await client.$disconnect();
}
