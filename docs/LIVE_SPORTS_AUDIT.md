# Live Sports Audit — The Odds API

Sprint 9.2.1 — Provider Go Live & Live Data Pipeline, Fase 1.

Auditoria real (não simulada) do catálogo de esportes da The Odds API,
obtida via `GET /v4/sports?all=true` usando a `ODDS_API_KEY` de produção,
executada localmente com `railway run` (a chave nunca passou pelo
terminal do operador nem apareceu em nenhuma saída deste processo).
Nenhuma escrita foi feita em nenhum banco de dados durante esta
auditoria.

Executado em: 2026-07-29 (consulta ao vivo).

## Resumo

| Métrica | Valor |
|---|---|
| Esportes totais retornados | 174 |
| Grupos de esporte distintos | 16 |
| Esportes ativos (todos os grupos) | 71 |
| Esportes de futebol (grupo "Soccer") | 67 |
| Ligas de futebol **ativas** agora | **40** |
| Ligas de futebol **inativas** agora | 27 |

## Grupos disponíveis

American Football, Aussie Rules, Baseball, Basketball, Boxing, Cricket,
Golf, Handball, Ice Hockey, Lacrosse, Mixed Martial Arts, Politics,
Rugby League, Rugby Union, **Soccer**, Tennis.

## Achado central — por que o Dashboard mostrava vazio

O valor até então fixo no código (`ODDS_SPORT_KEY` padrão =
`soccer_fifa_world_cup`) está **inativo agora** (`active: false`) —
confirmado nesta consulta. Não existe torneio de Copa do Mundo em
andamento neste momento, então essa liga nunca retorna eventos. Isso
explica exatamente o sintoma relatado ("Dashboard populado, mas 0
partidas/odds"): o provider sempre esteve saudável, mas a única liga
consultada estava, por definição, sempre vazia fora de um Mundial.

## Ligas de futebol ativas agora (40)

`soccer_argentina_primera_division`, `soccer_austria_bundesliga`,
`soccer_belgium_first_div`, `soccer_brazil_campeonato`,
`soccer_chile_campeonato`, `soccer_china_superleague`,
`soccer_conmebol_copa_libertadores`, `soccer_conmebol_copa_sudamericana`,
`soccer_denmark_superliga`, `soccer_efl_champ`, `soccer_england_efl_cup`,
`soccer_england_league1`, `soccer_england_league2`, `soccer_epl`,
`soccer_finland_veikkausliiga`, `soccer_france_ligue_one`,
`soccer_germany_bundesliga`, `soccer_germany_bundesliga2`,
`soccer_germany_dfb_pokal`, `soccer_germany_liga3`,
`soccer_greece_super_league`, `soccer_italy_serie_a`,
`soccer_italy_serie_b`, `soccer_korea_kleague1`,
`soccer_league_of_ireland`, `soccer_mexico_ligamx`,
`soccer_netherlands_eredivisie`, `soccer_norway_eliteserien`,
`soccer_poland_ekstraklasa`, `soccer_portugal_primeira_liga`,
`soccer_russia_premier_league`, `soccer_spain_la_liga`, `soccer_spl`,
`soccer_sweden_allsvenskan`, `soccer_sweden_superettan`,
`soccer_switzerland_superleague`, `soccer_turkey_super_league`,
`soccer_uefa_champs_league_qualification`, `soccer_uefa_nations_league`,
`soccer_usa_mls`.

## Ligas de futebol inativas agora (27, amostra relevante)

`soccer_fifa_world_cup` (Copa do Mundo — o antigo default fixo),
`soccer_fifa_world_cup_qualifiers_europe`,
`soccer_fifa_world_cup_qualifiers_south_america`,
`soccer_uefa_champs_league` (fora de temporada no momento da consulta),
`soccer_uefa_europa_league`, `soccer_fa_cup`, `soccer_copa_america`
(`soccer_conmebol_copa_america`), `soccer_brazil_serie_b`,
`soccer_japan_j_league`, entre outras 18 ligas (lista completa
disponível na saída bruta da auditoria, omitida aqui por brevidade —
todas sazonais/fora de calendário no momento desta consulta).

## Cobertura das ligas de prioridade usadas pela seleção automática (Fase 3)

| Liga prioritária | Existe no catálogo | Ativa agora |
|---|---|---|
| `soccer_epl` (Premier League) | sim | **sim** |
| `soccer_spain_la_liga` | sim | **sim** |
| `soccer_italy_serie_a` | sim | **sim** |
| `soccer_germany_bundesliga` | sim | **sim** |
| `soccer_france_ligue_one` | sim | **sim** |
| `soccer_uefa_champs_league` | sim | não (fora de temporada) |
| `soccer_brazil_campeonato` | sim | **sim** |
| `soccer_usa_mls` | sim | **sim** |
| `soccer_fifa_world_cup` (antigo default) | sim | **não** |

7 das 9 ligas de prioridade estão ativas agora — a seleção automática
(Fase 3) encontra uma liga com eventos já na primeira tentativa
(`soccer_epl`), sem precisar varrer as demais.

## Validação end-to-end real (Fase 2 + Fase 3, sem escrita no banco)

Executando as classes reais `LiveSportsDiscoveryService` e
`LeagueSelectionService` (implementadas nesta sprint) contra a API real,
via `railway run` (sem tocar o banco de dados):

- Ligas de futebol descobertas: **40**
- Liga selecionada: **`soccer_epl` (EPL)**, na primeira tentativa
- Eventos encontrados: **10**
- Odds (outcomes com preço > 1) encontradas: **980**
- Latência média por sondagem: **394ms**
- Latência da chamada de odds: **408ms**

## Esportes suportados pelo pipeline hoje

O pipeline (Fase 2/3) suporta, por design, **qualquer** liga do grupo
"Soccer" retornada pela API — não há mais uma lista fixa. A lista de
prioridade (Fase 3) apenas define a ORDEM de tentativa; ligas fora dela
continuam elegíveis como fallback automático.

## Créditos utilizados nesta auditoria

`remainingCredits` antes: 20000 · `usedCredits` reportado pela API: 0
(o cabeçalho `x-requests-used` da The Odds API reflete o dia inteiro,
não estas chamadas pontuais). Nenhum threshold, schema ou dado de
produção foi alterado por esta auditoria.
