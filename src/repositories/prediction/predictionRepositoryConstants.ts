// Sprint 7.3.1 — Refinamento Arquitetural do Prediction Repository.
// Única fonte de verdade para os limites de paginação da busca — nunca
// duplicados em outro arquivo. Valores idênticos aos já aprovados na
// Sprint 7.3, apenas movidos para um arquivo dedicado.

export const DEFAULT_SEARCH_LIMIT = 20;
export const MIN_SEARCH_LIMIT = 1;
export const MAX_SEARCH_LIMIT = 100;
export const MIN_SEARCH_OFFSET = 0;
