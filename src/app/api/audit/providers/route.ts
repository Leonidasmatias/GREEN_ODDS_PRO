import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redactSecrets } from "@/services/securityService";
import { isProviderEconomyMode } from "@/services/providerEconomyService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const oddsApiBaseUrl = "https://api.the-odds-api.com/v4";
const validRegions = new Set(["us", "us2", "uk", "au", "eu"]);

interface OddsApiSport {
  key: string;
  group?: string;
  title?: string;
  active?: boolean;
  has_outrights?: boolean;
}

function maskSecret(value?: string) {
  const secret = value?.trim();
  if (!secret) return null;
  if (secret.length <= 8) return `${secret.slice(0, 1)}***${secret.slice(-1)}`;
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function parseRegions(value: string) {
  return value.split(",").map((region) => region.trim().toLowerCase()).filter(Boolean);
}

function parseStatus(error?: string | null) {
  const match = error?.match(/HTTP\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

function safePriority() {
  return (process.env.ODDS_PROVIDER_PRIORITY || "the-odds-api,sportmonks,api-football")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
}

function recommendations(input: {
  keyPresent: boolean;
  sportsHttpStatus: number | null;
  sportSupported: boolean | null;
  invalidRegions: string[];
  sportKey: string;
  priority: string[];
  sportMonksConfigured: boolean;
  apiFootballConfigured: boolean;
}) {
  const fixes: string[] = [];
  if (!input.keyPresent) fixes.push("Configurar ODDS_API_KEY no Railway e redeployar o servico.");
  if (input.sportsHttpStatus === 401) fixes.push("Regenerar/conferir ODDS_API_KEY na The Odds API; o app usa query param apiKey conforme a documentacao oficial.");
  if (input.sportsHttpStatus && input.sportsHttpStatus >= 500) fixes.push("Repetir auditoria: a The Odds API respondeu erro 5xx temporario.");
  if (input.sportSupported === false) fixes.push(`Trocar ODDS_SPORT_KEY=${input.sportKey} por uma key ativa retornada por /v4/sports, ou usar upcoming temporariamente.`);
  if (input.invalidRegions.length) fixes.push(`Corrigir ODDS_REGIONS; regioes invalidas: ${input.invalidRegions.join(", ")}. Valores aceitos: us, us2, uk, au, eu.`);
  if (!input.sportMonksConfigured && !input.apiFootballConfigured && input.priority.some((provider) => provider !== "the-odds-api")) {
    fixes.push("Definir ODDS_PROVIDER_PRIORITY=the-odds-api enquanto SportMonks/API-Football nao estiverem configurados.");
  }
  if (!fixes.length) fixes.push("Provider auditavel; se ainda houver falha em odds, verificar permissao/plano da conta para mercados e esporte escolhidos.");
  return fixes;
}

async function auditTheOddsApi(apiKey: string | undefined, sportKey: string) {
  if (isProviderEconomyMode()) {
    return { sportsHttpStatus: null, sportsErrorSafe: "PROVIDER_ECONOMY_MODE active; live provider audit skipped", sportSupported: null, sportActive: null };
  }
  if (!apiKey) {
    return { sportsHttpStatus: null, sportsErrorSafe: "ODDS_API_KEY not configured", sportSupported: null, sportActive: null };
  }

  const url = new URL(`${oddsApiBaseUrl}/sports`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("all", "true");

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
    const body = await response.text();
    let sports: OddsApiSport[] = [];
    if (response.ok) {
      sports = JSON.parse(body) as OddsApiSport[];
    }
    const sport = sports.find((item) => item.key === sportKey);
    return {
      sportsHttpStatus: response.status,
      sportsErrorSafe: response.ok ? null : redactSecrets(body || `The Odds API HTTP ${response.status}`),
      sportSupported: response.ok ? Boolean(sport) : null,
      sportActive: sport?.active ?? null,
      sportTitle: sport?.title ?? null,
    };
  } catch (error) {
    return {
      sportsHttpStatus: null,
      sportsErrorSafe: redactSecrets(error instanceof Error ? error.message : "The Odds API audit failed"),
      sportSupported: null,
      sportActive: null,
    };
  }
}

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY?.trim();
  const sportKey = process.env.ODDS_SPORT_KEY?.trim() || "soccer_fifa_world_cup";
  const regions = process.env.ODDS_REGIONS?.trim() || "eu";
  const parsedRegions = parseRegions(regions);
  const invalidRegions = parsedRegions.filter((region) => !validRegions.has(region));
  const priority = safePriority();
  const sportMonksConfigured = Boolean(process.env.SPORTMONKS_API_KEY?.trim());
  const apiFootballConfigured = Boolean(process.env.FOOTBALL_API_KEY?.trim());

  const [liveAudit, lastProviderCall] = await Promise.all([
    auditTheOddsApi(apiKey, sportKey),
    prisma.providerCall.findFirst({ where: { provider: "the-odds-api" }, orderBy: { createdAt: "desc" } }).catch(() => null),
  ]);

  const storedHttpStatus = parseStatus(lastProviderCall?.error);
  const lastHttpStatus = liveAudit.sportsHttpStatus ?? storedHttpStatus;
  const lastErrorSafe = liveAudit.sportsErrorSafe ?? lastProviderCall?.error ?? null;
  const keyPresent = Boolean(apiKey);

  const providerStatus = {
    id: "the-odds-api",
    configured: keyPresent,
    providerPriority: priority,
    priorityRecommended: !sportMonksConfigured && !apiFootballConfigured ? ["the-odds-api"] : priority,
    authMethod: "query_param_apiKey",
    baseUrl: oddsApiBaseUrl,
    endpoints: {
      sportsAudit: "/sports?apiKey=[REDACTED]&all=true",
      events: `/sports/${sportKey}/events?apiKey=[REDACTED]&dateFormat=iso`,
      odds: `/sports/${sportKey}/odds?apiKey=[REDACTED]&regions=${regions}&markets=h2h,totals,spreads&oddsFormat=decimal&dateFormat=iso`,
    },
    sportSupported: liveAudit.sportSupported,
    sportActive: liveAudit.sportActive,
    sportTitle: liveAudit.sportTitle ?? null,
    regionsValid: invalidRegions.length === 0,
  };

  return NextResponse.json({
    providerStatus,
    keyPresent,
    keyMasked: maskSecret(apiKey),
    sportKey,
    regions,
    lastHttpStatus,
    lastErrorSafe: lastErrorSafe ? redactSecrets(lastErrorSafe) : null,
    recommendedFixes: recommendations({
      keyPresent,
      sportsHttpStatus: liveAudit.sportsHttpStatus,
      sportSupported: liveAudit.sportSupported,
      invalidRegions,
      sportKey,
      priority,
      sportMonksConfigured,
      apiFootballConfigured,
    }),
    security: {
      exposesFullApiKey: false,
      logsFullApiKey: false,
      uiFullApiKeyExposureRisk: false,
    },
    checkedAt: new Date().toISOString(),
  });
}
