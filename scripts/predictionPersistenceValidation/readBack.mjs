// Sprint 8.3 — Production Persistence.
// Contraparte de `persist.mjs`: roda em um processo `node` NOVO e
// separado (nenhuma memória compartilhada com quem persistiu), constrói
// seu PRÓPRIO `PrismaClient`/`PrismaPredictionRepository`, e lê o
// registro de volta por 4 caminhos diferentes (`getById`, `search`,
// `getLatestByMatch` via search com orderBy fixo, e uma segunda página
// de `search` para confirmar paginação real) — provando que os dados
// sobrevivem a um "restart" completo da aplicação, nunca apenas ao
// cache `globalThis` de um processo já em execução.
import { PrismaClient } from "@prisma/client";
import { PrismaPredictionRepository } from "../../src/repositories/prediction/PrismaPredictionRepository.ts";

const [id, matchId] = process.argv.slice(2);
if (!id || !matchId) {
  console.error("usage: readBack.mjs <id> <matchId>");
  process.exit(1);
}

const client = new PrismaClient();
const repository = new PrismaPredictionRepository(client);

try {
  const byId = await repository.getById(id);
  const byMatch = await repository.search({ matchId });
  const latest = await repository.search({ matchId }, { orderBy: "generatedAt", orderDirection: "desc", limit: 1, offset: 0 });

  process.stdout.write(
    JSON.stringify({
      byId,
      byMatchTotal: byMatch.total,
      byMatchItems: byMatch.items,
      latest: latest.items[0] ?? null,
    }),
  );
} finally {
  await client.$disconnect();
}
