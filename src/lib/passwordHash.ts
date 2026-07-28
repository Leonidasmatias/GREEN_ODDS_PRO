// Utilitários de credenciais (hash/verificação de senha, normalização de
// e-mail, validação mínima) — extraídos de `src/services/authService.ts`
// para este arquivo independente do runtime do Next.js (nenhum import de
// `next/headers`/`next/navigation`). Isso permite reuso tanto pelo
// fluxo normal de autenticação quanto por scripts standalone (ex.:
// `scripts/bootstrap-admin.mjs`, executado via `node`, fora do contexto
// de requisição do Next.js). Comportamento idêntico ao já existente —
// nenhuma regra de validação foi alterada nesta extração.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored?.startsWith("scrypt:")) return false;
  const [, salt, key] = stored.split(":");
  const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(key, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Mesma validação já usada por `registerUser` — centralizada aqui para
 * ser reaproveitada também pelo bootstrap de administrador. */
export function assertValidCredentials(email: string, password: string) {
  if (!email.includes("@")) throw new Error("EMAIL_INVALID");
  if (password.length < 8) throw new Error("PASSWORD_TOO_SHORT");
}
