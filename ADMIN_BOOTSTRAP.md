# Bootstrap do Primeiro Administrador — GREEN ODDS PRO

## Objetivo

Este projeto **não** possui nenhum usuário administrador pré-configurado, seed ou senha padrão. Para obter a primeira conta com `role = ADMIN`, execute o script de bootstrap descrito aqui.

O fluxo normal de registro (`/register`) **nunca** cria contas ADMIN — toda conta criada pela interface nasce com `role = "USER"`. A única forma oficial de criar um ADMIN é este script.

## Pré-requisitos

- `DATABASE_URL` configurada e apontando para um banco Postgres acessível (o mesmo usado pela aplicação).
- Dependências instaladas (`npm install`) e Prisma Client gerado (`npm run prisma:generate`, já executado automaticamente pelo `postinstall`).

## Como executar

O script lê as credenciais **exclusivamente de variáveis de ambiente** — nenhuma credencial é hardcoded no código.

### Variáveis

| Variável | Obrigatória | Descrição |
|---|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | Sim | E-mail da conta administradora a ser criada |
| `BOOTSTRAP_ADMIN_PASSWORD` | Sim | Senha (mínimo 8 caracteres — mesma regra do registro normal) |
| `BOOTSTRAP_ADMIN_NAME` | Não | Nome de exibição (opcional) |

### Opção 1 — variáveis inline (uma execução pontual)

```bash
BOOTSTRAP_ADMIN_EMAIL="voce@dominio.com" BOOTSTRAP_ADMIN_PASSWORD="SenhaForteAqui123" npm run bootstrap:admin
```

No PowerShell (Windows):

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL="voce@dominio.com"; $env:BOOTSTRAP_ADMIN_PASSWORD="SenhaForteAqui123"; npm run bootstrap:admin
```

### Opção 2 — a partir de um arquivo `.env` local

Adicione as variáveis a um arquivo `.env` (nunca commitado — já ignorado pelo `.gitignore` do projeto) e execute:

```bash
node --env-file=.env scripts/bootstrap-admin.mjs
```

## Comportamento

1. **Se já existir qualquer usuário com `role = ADMIN`**: o script não cria nada, imprime o e-mail do administrador já existente e encerra com sucesso (idempotente — seguro executar mais de uma vez).
2. **Se o e-mail informado já pertencer a uma conta existente** (de qualquer papel): o script recusa e encerra com erro — ele **nunca promove** uma conta existente automaticamente. Se essa for realmente a intenção, a promoção deve ser feita manualmente (ex.: `npm run db:studio`, alterando o campo `role` para `"ADMIN"`).
3. **Caso contrário**: cria o usuário com a senha criptografada (mesmo algoritmo — `scrypt` — usado pelo registro normal, via `hashPassword` compartilhado), `role = "ADMIN"`, `status = "ACTIVE"`, e concede acesso completo (plano `PREMIUM`) para que o administrador não seja bloqueado por restrições de plano em nenhuma rota interna.

## Segurança

- Nenhuma credencial hardcoded em nenhum arquivo do repositório.
- A senha é sempre armazenada com hash (`scrypt` + salt aleatório por conta) — nunca em texto plano.
- O script nunca imprime a senha ou o hash no terminal.
- Execute este script apenas em um ambiente confiável (a variável de ambiente com a senha fica temporariamente visível no histórico do shell/processo — prefira a Opção 2 com um `.env` local não versionado quando possível).

## Arquivos envolvidos

- `scripts/bootstrap-admin.mjs` — o script em si.
- `src/lib/passwordHash.ts` — hashing/verificação de senha e validação mínima de credenciais, compartilhados entre o registro normal (`src/services/authService.ts`) e este bootstrap (extraído para um módulo independente do runtime do Next.js, executável também via `node` puro).
- `src/services/subscriptionAccess.ts` — `assignPremiumPlan`, usada apenas pelo bootstrap (o registro normal continua usando `assignFreePlan`, inalterado).

## O que este script explicitamente NÃO faz

- Não altera o fluxo normal de registro (`registerUser` continua criando exclusivamente contas `USER`, com o plano `FREE`).
- Não permite que o registro pela UI resulte em uma conta ADMIN.
- Não cria um segundo administrador.
- Não expõe hashes, senhas ou segredos no terminal.
