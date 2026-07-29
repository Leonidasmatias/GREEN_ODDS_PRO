# Conta técnica de validação — `railway-validation-1785286319@example.com`

Sprint 8.3.2 — Production Hardening & Operations. Este documento apenas
**descreve** a conta; nenhuma ação foi tomada sobre ela por esta sprint
(não foi excluída, não teve senha ou permissões alteradas).

## Origem

Criada na Sprint 8.3.1, Fase 17, via `scripts/bootstrap-admin.mjs`, para
validar de ponta a ponta a Prediction API e o Dashboard/Timeline contra o
PostgreSQL real do Railway recém-provisionado — não havia, até então,
nenhuma conta de usuário no banco (banco novo, vazio).

| Campo | Valor |
|---|---|
| E-mail | `railway-validation-1785286319@example.com` |
| Nome | `Railway Validation` |
| Papel (`role`) | `ADMIN` (única forma de bootstrap sem conta prévia — `role` permanece inerte para controle de acesso ao Prediction Center, que depende exclusivamente do plano) |
| Plano | `PREMIUM` (atribuído automaticamente pelo bootstrap, necessário para acessar `predictionCenter`) |
| Dados pessoais | nenhum — e-mail de domínio `example.com`, claramente identificado com o prefixo `railway-validation-` |

## Finalidade

Exclusivamente técnica: permitir chamadas autenticadas às rotas
`/api/predictions*` (protegidas por `getApiAccess`) e o login manual no
Dashboard (`/prediction/history`) durante a validação de produção da
Sprint 8.3.1. Não deve ser usada para nenhum outro propósito (não é uma
conta de suporte, não é uma conta de demonstração para terceiros).

## Registros associados

Os 2 registros de previsão criados por esta conta (`matchId` com prefixo
`railway-validation-`) permanecem no banco como evidência técnica da
validação de persistência real e de restart, conforme decidido na Sprint
8.3.1 (Fase 16: "a preferência é manter o registro de validação
identificado como evidência técnica, desde que ele não contenha dado
pessoal").

## Quando utilizar

Somente para: (a) validar novamente a Prediction API/Dashboard após um
deploy relevante, quando não houver outra conta de teste disponível; (b)
depuração pontual de um problema de autenticação/autorização em produção,
com autorização explícita. Nunca para uso operacional contínuo.

## Quando remover

Recomendado remover (conta + registros associados) quando **qualquer**
uma destas condições for verdadeira: (1) uma conta administrativa real e
definitiva for criada para operar o ambiente de produção; (2) a
aplicação for liberada para usuários reais e a presença de uma conta
`ADMIN` de teste deixar de ser desejável; (3) os registros de validação
associados não forem mais necessários como evidência. A exclusão em si
segue como um checkpoint separado, com autorização explícita própria
(nunca automática) — não faz parte do escopo desta sprint.

## Riscos enquanto a conta existir

- É a **única** conta `role=ADMIN` no banco hoje — `bootstrap-admin.mjs`
  recusa criar uma segunda (`existingAdmin` já encontrado), então
  qualquer necessidade futura de bootstrap de um administrador real
  exigirá primeiro decidir o que fazer com esta conta (promovê-la
  trocando e-mail/senha, ou removê-la).
- A senha atual foi definida durante a Sprint 8.3.1 (redefinida uma vez,
  com autorização explícita, para permitir a validação via navegador) e
  não é conhecida por nenhum processo automatizado — nunca foi
  persistida em arquivo, log ou commit. Perda de acesso a essa senha não
  é um incidente: a conta é descartável por definição.
- Plano `PREMIUM` permanente associado — sem custo/risco financeiro real
  (não há cobrança neste projeto), mas caso o sistema de billing seja
  ativado no futuro, essa concessão deve ser revisada antes.
