import test from "node:test";
import assert from "node:assert/strict";
import {
  createRedactor,
  redactConfigObject,
  redactDeep,
  redactHeaders,
  redactUrl,
} from "../src/providers/betsapi/BetsApiRedaction.ts";
import {
  BetsApiAuthenticationError,
  BetsApiConfigurationError,
  BetsApiError,
  BetsApiNetworkError,
  BetsApiPermissionError,
  BetsApiRateLimitError,
  BetsApiResponseError,
  BetsApiTimeoutError,
  BetsApiUnavailableError,
  BetsApiValidationError,
} from "../src/providers/betsapi/BetsApiErrors.ts";

const SECRET = "sk_live_super_secret_123";

test("redactUrl strips a token query parameter using the generic pattern, even without knowing the value", () => {
  const url = "https://api.b365api.com/v3/events/upcoming?token=SECRET&sport_id=1";
  assert.equal(redactUrl(url), "https://api.b365api.com/v3/events/upcoming?token=[REDACTED]&sport_id=1");
});

test("redactUrl also strips the exact known token value wherever it appears", () => {
  const url = `https://api.b365api.com/v3/league?token=${SECRET}&sport_id=1`;
  const redacted = redactUrl(url, SECRET);
  assert.ok(!redacted.includes(SECRET));
});

test("redactHeaders masks Authorization and API-key style headers, never leaking the secret", () => {
  const redacted = redactHeaders({ Authorization: `Bearer ${SECRET}`, "X-Api-Key": SECRET, "Content-Type": "application/json" }, SECRET);
  assert.equal(redacted.Authorization, "[REDACTED]");
  assert.equal(redacted["X-Api-Key"], "[REDACTED]");
  assert.equal(redacted["Content-Type"], "application/json");
});

test("redactConfigObject never returns the real token value", () => {
  const config = { token: SECRET, baseUrl: "https://api.b365api.com", mode: "live" };
  const redacted = redactConfigObject(config);
  assert.notEqual(redacted.token, SECRET);
  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(redacted.baseUrl, "https://api.b365api.com");
});

test("redactDeep sanitizes nested objects/arrays recursively, including a token= inside a nested URL string", () => {
  const snapshot = {
    request: { url: `https://api.b365api.com/v3/league?token=${SECRET}&sport_id=1`, headers: { Authorization: SECRET } },
    events: [{ id: "1", note: `see token=${SECRET} in logs` }],
  };
  const redacted = redactDeep(snapshot, SECRET);
  const serialized = JSON.stringify(redacted);
  assert.ok(!serialized.includes(SECRET));
});

test("createRedactor closes over a known token and applies it across url/headers/errorMessage/deep", () => {
  const redactor = createRedactor(SECRET);
  assert.ok(!redactor.url(`https://x?token=${SECRET}`).includes(SECRET));
  assert.ok(!redactor.errorMessage(`failed with token ${SECRET}`).includes(SECRET));
  assert.ok(!JSON.stringify(redactor.deep({ token: SECRET })).includes(SECRET));
});

test("every BetsApiError subclass carries only code/status/endpoint/retryable/safeMessage, never the raw token", () => {
  const endpoint = `/v3/events/upcoming?token=${SECRET}`;
  const errors = [
    new BetsApiConfigurationError("config invalida", { endpoint, secret: SECRET }),
    new BetsApiAuthenticationError("token invalido", { endpoint, secret: SECRET }),
    new BetsApiPermissionError("sem permissao", { endpoint, secret: SECRET }),
    new BetsApiRateLimitError("rate limit", { endpoint, secret: SECRET }),
    new BetsApiValidationError("parametro invalido", { endpoint, secret: SECRET }),
    new BetsApiTimeoutError("timeout", { endpoint, secret: SECRET }),
    new BetsApiNetworkError("falha de rede", { endpoint, secret: SECRET }),
    new BetsApiResponseError("resposta invalida", { endpoint, secret: SECRET }),
    new BetsApiUnavailableError("indisponivel", { endpoint, secret: SECRET }),
  ];
  for (const error of errors) {
    assert.ok(error instanceof BetsApiError);
    assert.ok(!error.endpoint.includes(SECRET), `endpoint vazou o token: ${error.endpoint}`);
    assert.ok(!error.safeMessage.includes(SECRET));
    assert.ok(!error.message.includes(SECRET));
    assert.ok(!JSON.stringify(error).includes(SECRET));
  }
});

test("retryable flags match the documented retry policy per error type", () => {
  assert.equal(new BetsApiAuthenticationError("x").retryable, false);
  assert.equal(new BetsApiPermissionError("x").retryable, false);
  assert.equal(new BetsApiValidationError("x").retryable, false);
  assert.equal(new BetsApiConfigurationError("x").retryable, false);
  assert.equal(new BetsApiRateLimitError("x").retryable, true);
  assert.equal(new BetsApiTimeoutError("x").retryable, true);
  assert.equal(new BetsApiNetworkError("x").retryable, true);
  assert.equal(new BetsApiUnavailableError("x").retryable, true);
});

test("a cause containing the token is sanitized before being stored", () => {
  const error = new BetsApiNetworkError("falha de rede", { cause: new Error(`connect failed token=${SECRET}`), secret: SECRET });
  assert.ok(!error.cause.includes(SECRET));
});
