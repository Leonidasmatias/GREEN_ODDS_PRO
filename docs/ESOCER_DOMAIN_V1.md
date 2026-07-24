# Fundação do Domínio eSoccer — Fase 1 (ESOCCER INTELLIGENCE V1)

> Observação sobre o nome do arquivo: o nome `ESOCER_DOMAIN_V1.md` foi mantido
> conforme solicitado na missão. Ao longo deste documento a grafia correta
> **eSoccer** é usada sempre que o produto é mencionado em texto.

## 1. Objetivo

Este documento descreve a fundação técnica do domínio eSoccer construída na
Fase 1 do projeto GREEN ODDS PRO — ESOCCER INTELLIGENCE V1. O objetivo desta
fase é exclusivamente estrutural: modelar os dados, criar utilitários de
normalização e parsing, um serviço de validação de domínio, fixtures locais e
testes automatizados. Nenhuma integração real com a BetsAPI, nenhum cálculo
produtivo de rating/estatísticas e nenhuma recomendação de aposta em produção
foram implementados nesta fase.

## 2. Identidade do jogador

No eSoccer, cada "jogador" (a pessoa real por trás do simulador) é
identificado por um **nickname**, e é esse nickname — não o clube ou seleção
virtual usado na partida — que carrega o histórico estatístico permanente:
resultados, forma recente, confrontos diretos (H2H), rating e, futuramente,
previsões e recomendações. Um mesmo jogador pode aparecer em partidas
diferentes usando equipes virtuais diferentes; a entidade `ESoccerPlayer`
(chave: `normalizedNickname`) é o que persiste entre essas partidas, nunca a
equipe virtual.

## 3. Equipe virtual

A equipe virtual (ex.: "Bologna", "Spain") é apenas o **contexto** de uma
partida específica — o clube ou seleção que o jogador escolheu controlar
naquele confronto. A entidade `ESoccerVirtualTeam` existe para permitir
deduplicação e consulta de nomes de equipe, mas **não representa a
identidade permanente de nenhum jogador**, e a mesma equipe virtual pode ser
usada por diversos jogadores diferentes ao longo do tempo.

## 4. Exemplo de parsing

Entrada:

```
Bologna (Nightxx)
```

Saída de `parseESoccerParticipant`:

```json
{
  "virtualTeam": "Bologna",
  "playerNickname": "Nightxx"
}
```

(O objeto real retornado também inclui `raw`, `normalizedVirtualTeam` e
`normalizedPlayerNickname` — ver seção 6.)

## 5. Models

Todos os models abaixo foram adicionados a `prisma/schema.prisma`, seguindo
as convenções já usadas no restante do projeto (id `cuid()`, `createdAt`/
`updatedAt`, `@@map` para snake_case, índices e uniques compostos).

- **ESoccerPlayer** — identidade permanente do jogador. Chave de deduplicação:
  `normalizedNickname` (único). Guarda `firstSeenAt`/`lastSeenAt` e status
  (`ACTIVE`/`INACTIVE`).
- **ESoccerPlayerAlias** — apelidos alternativos vinculados explicitamente a
  um jogador (`normalizedAlias` único). Sem fuzzy matching automático.
- **ESoccerLeague** — liga/competição eSoccer (ex.: "Esoccer Battle - 8 mins
  play"), com `provider` e duração de partida opcional.
- **ESoccerVirtualTeam** — equipe/seleção virtual, deduplicada por
  `normalizedName`. Não é a identidade do jogador (seção 3).
- **ESoccerMatch** — a partida em si: dois jogadores (`homePlayerId`/
  `awayPlayerId`), equipes virtuais opcionais, placar opcional, nomes brutos
  preservados (`rawHomeName`/`rawAwayName`) e `sourcePayload` (texto
  serializado) para auditoria futura da origem do dado.
- **ESoccerPlayerRating** — histórico de rating por jogador (Elo/Glicko/
  custom). Nesta fase apenas o armazenamento existe; o cálculo real não foi
  implementado.
- **ESoccerPlayerRollingStats** — estatísticas de janela móvel (5/10/20
  partidas) por jogador. Cálculo real não implementado nesta fase.
- **ESoccerHeadToHeadStats** — estatísticas agregadas de confronto direto
  entre dois jogadores, com par sempre canônico (seção 8). Agregação real
  não implementada nesta fase.
- **ESoccerPrediction** — probabilidades de uma previsão de partida. Cálculo
  do modelo real não implementado nesta fase.
- **ESoccerRecommendation** — recomendação derivada de uma previsão, com
  status provisório (seção 11). Não usada em produção nesta fase.

Sete enums nativos do Prisma foram criados para dar segurança de tipo a
campos que, no restante do projeto, historicamente usam `String` livre:
`ESoccerPlayerStatus`, `ESoccerLeagueStatus`, `ESoccerMatchStatus`,
`ESoccerProvider`, `ESoccerRatingSystem`, `ESoccerRecommendationStatus` e
`ESoccerMarket`. Esta é a primeira vez que o projeto usa `enum` nativo do
Prisma — uma escolha deliberada para o novo domínio eSoccer, sem alterar
nenhum model pré-existente.

Os campos `sourcePayload` (em `ESoccerMatch`) e `riskFlags` (em
`ESoccerRecommendation`) foram implementados como `String?` (JSON
serializado manualmente), e não como o tipo nativo `Json` do Prisma — isso
segue exatamente o mesmo padrão já usado em todo o projeto (`AuditLog.metadata`,
`MatchResult.rawPayload`, etc.), para manter consistência arquitetural total
com o restante do código.

## 6. Normalização

`src/lib/esoccer/normalization.ts` implementa `normalizeESoccerNickname` e
`normalizeVirtualTeamName`, ambas seguindo a mesma sequência de regras:

1. `trim()` — remove espaços nas bordas;
2. `normalize("NFKC")` — normalização Unicode de compatibilidade (ex.: a
   ligadura "ﬁ" vira "fi");
3. colapso de espaços internos múltiplos em um único espaço
   (`replace(/\s+/g, " ")`);
4. `toLowerCase()` — gera a chave de comparação em minúsculas.

Números, hífens, underscores e pontos são preservados sem alteração. Um
valor que resulte em string vazia após essas etapas lança
`ESoccerNormalizationError`. O comportamento é determinístico: a mesma
entrada sempre produz a mesma saída. Nenhuma forma de fuzzy matching é
aplicada — dois nicknames parecidos nunca são tratados como o mesmo jogador.

## 7. Aliases

`ESoccerPlayerAlias` permite registrar apelidos alternativos de um jogador
(por exemplo, uma variação de grafia usada por um provider específico). O
vínculo entre um alias e um jogador é sempre **explícito** — criado
manualmente ou por uma regra de ingestão futura clara — e nunca inferido
automaticamente por similaridade de texto. Isso evita que dois jogadores
diferentes sejam acidentalmente fundidos por um algoritmo de fuzzy matching.

## 8. H2H canônico

Como duas partidas entre os mesmos dois jogadores podem ocorrer com papéis
de casa/visitante invertidos, `ESoccerHeadToHeadStats` armazena sempre o
mesmo par na mesma ordem: `canonicalizePlayerPair` (em
`src/lib/esoccer/normalization.ts`) recebe dois identificadores e devolve
sempre `[menor, maior]`, tanto para strings (ordem lexicográfica) quanto para
números. O menor valor é armazenado em `playerAId`, o maior em `playerBId`,
garantido no schema por `@@unique([playerAId, playerBId])`. A regra "um
jogador não pode enfrentar ele mesmo" não é imposta por essa função de
ordenação pura — é responsabilidade de
`validateMatchParticipants` em `src/services/esoccerDomainService.ts`.

## 9. Regras de placar

`validateFinishedScore(status, homeScore, awayScore)` implementa:

- placares, quando presentes, devem ser inteiros não negativos;
- quando `status === "FINISHED"`, ambos os placares são obrigatórios;
- para qualquer outro status, os placares podem estar ausentes
  (`null`/`undefined`);
- mesmo quando o status não é `FINISHED`, se um placar estiver presente ele
  ainda precisa ser um inteiro não negativo válido.

Esta função aceita `status` como `string` (o valor do enum
`ESoccerMatchStatus` é atribuível a `string`), evitando qualquer dependência
do Prisma Client dentro do serviço de domínio.

## 10. Probabilidades

`validatePredictionProbabilities({ homeWinProbability, drawProbability,
awayWinProbability })` exige que os três valores sejam números finitos,
cada um entre 0 e 1, e que a soma dos três seja aproximadamente 1, com
tolerância máxima de `0.0001` para absorver erro de arredondamento de ponto
flutuante sem mascarar somas realmente inválidas.

## 11. Confiança provisória

`classifyRecommendationStatus(confidenceScore)` classifica um score de 0 a
100 em três faixas:

```
0–49   -> NO_BET
50–69  -> OBSERVATION
70–100 -> APPROVED
```

**Estes limiares são PROVISÓRIOS.** Foram definidos como ponto de partida
razoável para esta fase de fundação e **serão recalibrados após backtests
reais** com dados de eSoccer, quando a Fase 2 (BetsAPI) e fases seguintes
gerarem histórico suficiente. Valores fora do intervalo 0–100, `NaN` ou
`Infinity` são rejeitados com `ESoccerDomainValidationError`.

## 12. Fixtures

`tests/fixtures/esoccerMatches.mjs` contém quatro partidas simuladas
(`Juventus (Kavviro) vs Roma (nekishka)`, `Napoli (Grellz) vs Sassuolo
(riko)`, `Spain (DangerDim77) vs England (A1ose)`, `Bologna (Nightxx) vs
Napoli (Grellz)`), todas marcadas explicitamente com a constante
`ESOCCER_FIXTURES_DATA_KIND = "SIMULATED_TEST_DATA"`. **Nenhuma dessas
partidas, placares ou horários corresponde a um evento real.** Servem
apenas para exercitar o parser e os testes automatizados desta fase.

## 13. Fora do escopo

Esta fase **não** implementa:

- integração real com a BetsAPI;
- consumo de odds reais;
- cálculo de rating Elo/Glicko;
- cálculo produtivo de rolling stats;
- agregação produtiva de estatísticas H2H;
- previsões reais de partida;
- recomendações de aposta em produção;
- deploy;
- migração de banco em produção.

## 14. Próxima fase

**FASE 2 — BetsAPI Provider Sandbox**, com escopo esperado: contrato
`ESoccerDataProvider`; `BetsApiProvider`; provider de fixtures; DTOs de
eventos; ingestão idempotente; mapeamento de payload; sincronização
simulada; testes sem credencial real; feature flag `BETSAPI_ENABLED=false`.
