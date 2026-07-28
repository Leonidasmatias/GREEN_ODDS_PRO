// Bootstrap do primeiro administrador do GREEN ODDS PRO.
//
// Uso (documentado por completo em ADMIN_BOOTSTRAP.md):
//   BOOTSTRAP_ADMIN_EMAIL=voce@dominio.com BOOTSTRAP_ADMIN_PASSWORD=SenhaForte123 node scripts/bootstrap-admin.mjs
//   ou, com variáveis já carregadas de um arquivo .env:
//   node --env-file=.env scripts/bootstrap-admin.mjs
//
// Variáveis de ambiente:
//   BOOTSTRAP_ADMIN_EMAIL     (obrigatória)
//   BOOTSTRAP_ADMIN_PASSWORD  (obrigatória, mínimo 8 caracteres)
//   BOOTSTRAP_ADMIN_NAME      (opcional)
//
// Nenhuma credencial é hardcoded neste script — email e senha vêm
// exclusivamente do ambiente, fornecidos pelo operador no momento da
// execução.
//
// Regras aplicadas (nunca contornadas):
//   - Se já existir QUALQUER usuário com role ADMIN, o script não cria
//     nada — apenas informa qual e-mail já é administrador e encerra.
//   - Se o e-mail informado já pertencer a uma conta existente (de
//     qualquer papel), o script recusa e encerra sem alterar nada —
//     nunca promove uma conta existente automaticamente.
//   - O fluxo normal de registro (`/register`, `registerUser`) nunca é
//     tocado por este script e continua criando exclusivamente contas
//     com role USER.

import { prisma } from "../src/lib/prisma.ts";
import { assertValidCredentials, hashPassword, normalizeEmail } from "../src/lib/passwordHash.ts";
import { assignPremiumPlan } from "../src/services/subscriptionAccess.ts";

async function main() {
  const rawEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || undefined;

  if (!rawEmail || !password) {
    console.error(
      "[bootstrap-admin] ERRO: defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD antes de executar este script. Veja ADMIN_BOOTSTRAP.md.",
    );
    process.exitCode = 1;
    return;
  }

  const email = normalizeEmail(rawEmail);

  try {
    assertValidCredentials(email, password);
  } catch (error) {
    console.error(`[bootstrap-admin] ERRO: credenciais inválidas (${error instanceof Error ? error.message : error}).`);
    process.exitCode = 1;
    return;
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    console.log(
      `[bootstrap-admin] Já existe um administrador configurado (e-mail: ${existingAdmin.email}). Nenhuma ação foi realizada — este script nunca cria um segundo ADMIN.`,
    );
    return;
  }

  const existingUserWithEmail = await prisma.user.findUnique({ where: { email } });
  if (existingUserWithEmail) {
    console.error(
      `[bootstrap-admin] ERRO: já existe uma conta com o e-mail "${email}" (papel atual: ${existingUserWithEmail.role}). Este script nunca promove uma conta existente — utilize outro e-mail, ou promova manualmente (ex.: Prisma Studio) se essa for realmente sua intenção.`,
    );
    process.exitCode = 1;
    return;
  }

  const admin = await prisma.user.create({
    data: { name, email, passwordHash: hashPassword(password), role: "ADMIN", status: "ACTIVE" },
  });

  await assignPremiumPlan(admin.id);

  console.log(`[bootstrap-admin] Administrador criado com sucesso (e-mail: ${admin.email}).`);
}

main()
  .catch((error) => {
    console.error("[bootstrap-admin] Falha inesperada:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
