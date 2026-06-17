import { NextResponse } from "next/server";
import { redactSecrets } from "@/services/securityService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const baseUrl = "https://api.the-odds-api.com/v4";

function safeUrl(url: URL) {
  const copy = new URL(url.toString());
  if (copy.searchParams.has("apiKey")) copy.searchParams.set("apiKey", "[REDACTED]");
  return copy.toString();
}

function buildUrl(path: string, params: Record<string, string>) {
  const apiKey = process.env.ODDS_API_KEY?.trim();
  const url = new URL(`${baseUrl}${path}`);
  Object.entries({ ...params, apiKey: apiKey ?? "" }).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function requestPreview(url: URL) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: { accept: "application/json" },
  });
  const body = await response.text();
  return {
    httpStatus: response.status,
    ok: response.ok,
    latencyMs: Date.now() - startedAt,
    remaining: response.headers.get("x-requests-remaining"),
    used: response.headers.get("x-requests-used"),
    responsePreview: redactSecrets(body.slice(0, 700)),
  };
}

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY?.trim();
  const sportKey = process.env.ODDS_SPORT_KEY?.trim() || "soccer_fifa_world_cup";
  const regions = process.env.ODDS_REGIONS?.trim() || "eu";
  const apiKeyPresent = Boolean(apiKey);
  const apiKeyLength = apiKey?.length ?? 0;

  const eventsUrl = buildUrl(`/sports/${sportKey}/events`, { dateFormat: "iso" });
  const oddsUrl = buildUrl(`/sports/${sportKey}/odds`, {
    regions,
    markets: "h2h,totals,spreads",
    oddsFormat: "decimal",
    dateFormat: "iso",
  });

  console.log(`[provider-audit] apiKeyPresent=${apiKeyPresent}`);
  console.log(`[provider-audit] apiKeyLength=${apiKeyLength}`);
  console.log(`[provider-audit] endpoint=${safeUrl(eventsUrl)}`);

  if (!apiKeyPresent) {
    return NextResponse.json({
      apiKeyPresent,
      apiKeyLength,
      providerLoaded: true,
      endpointUsed: safeUrl(eventsUrl),
      sportKey,
      regions,
      httpStatus: null,
      responsePreview: null,
      errorSafe: "ODDS_API_KEY not loaded in process.env",
    });
  }

  try {
    const events = await requestPreview(eventsUrl);
    console.log(`[provider-audit] status=${events.httpStatus}`);
    if (!events.ok) {
      return NextResponse.json({
        apiKeyPresent,
        apiKeyLength,
        providerLoaded: true,
        endpointUsed: safeUrl(eventsUrl),
        sportKey,
        regions,
        httpStatus: events.httpStatus,
        responsePreview: events.responsePreview,
        errorSafe: `events endpoint failed with HTTP ${events.httpStatus}`,
        headersSent: { accept: "application/json" },
        queryParamsSent: { dateFormat: "iso", apiKey: "[REDACTED]" },
        checks: { events },
      });
    }

    console.log(`[provider-audit] endpoint=${safeUrl(oddsUrl)}`);
    const odds = await requestPreview(oddsUrl);
    console.log(`[provider-audit] status=${odds.httpStatus}`);
    return NextResponse.json({
      apiKeyPresent,
      apiKeyLength,
      providerLoaded: true,
      endpointUsed: safeUrl(oddsUrl),
      sportKey,
      regions,
      httpStatus: odds.httpStatus,
      responsePreview: odds.responsePreview,
      errorSafe: odds.ok ? null : `odds endpoint failed with HTTP ${odds.httpStatus}`,
      headersSent: { accept: "application/json" },
      queryParamsSent: { regions, markets: "h2h,totals,spreads", oddsFormat: "decimal", dateFormat: "iso", apiKey: "[REDACTED]" },
      checks: { events, odds },
    });
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "The Odds API live audit failed");
    console.log("[provider-audit] status=ERROR");
    return NextResponse.json({
      apiKeyPresent,
      apiKeyLength,
      providerLoaded: true,
      endpointUsed: safeUrl(eventsUrl),
      sportKey,
      regions,
      httpStatus: null,
      responsePreview: null,
      errorSafe: message,
    }, { status: 502 });
  }
}
