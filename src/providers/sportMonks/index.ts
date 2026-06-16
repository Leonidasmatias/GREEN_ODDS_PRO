import { filterMatches } from "../competitionFilter";
import type { OddsProvider, ProviderMatch, ProviderOdd, ProviderResponse, ProviderResult } from "../types";

type Json = Record<string, unknown>;
const array = (value: unknown) => Array.isArray(value) ? value as Json[] : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => Number(value ?? 0);

export class SportMonksProvider implements OddsProvider {
  readonly id = "sportmonks";
  readonly licensed = true;
  isConfigured() { return Boolean(process.env.SPORTMONKS_API_KEY?.trim()); }
  private async request(path: string, params: Record<string, string> = {}): Promise<ProviderResponse<Json[]>> {
    const token = process.env.SPORTMONKS_API_KEY?.trim();
    if (!token) throw new Error("SPORTMONKS_API_KEY não configurada");
    const url = new URL(`${process.env.SPORTMONKS_BASE_URL?.trim() || "https://api.sportmonks.com/v3/football"}${path}`);
    Object.entries({ ...params, api_token: token }).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`SportMonks HTTP ${response.status}`);
    const body = await response.json() as { data?: Json[]; rate_limit?: { remaining?: number } };
    return { data: body.data ?? [], remainingLimit: body.rate_limit?.remaining };
  }
  private dates() { const from = new Date(); const to = new Date(Date.now() + 3 * 86400000); return [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)]; }
  private normalizeFixture(item: Json): ProviderMatch {
    const participants = array(item.participants);
    const home = participants.find((participant) => (participant.meta as Json | undefined)?.location === "home") ?? participants[0] ?? {};
    const away = participants.find((participant) => (participant.meta as Json | undefined)?.location === "away") ?? participants[1] ?? {};
    const league = item.league as Json | undefined;
    const state = text((item.state as Json | undefined)?.state ?? item.result_info).toLowerCase();
    const status = state.includes("finished") || state.includes("ft") ? "FINISHED" : state.includes("live") || state.includes("half") ? "LIVE" : state.includes("cancel") ? "CANCELLED" : "PRE_GAME";
    const scores = array(item.scores); const current = scores.filter((score) => (score.description === "CURRENT" || score.description === "2ND_HALF"));
    const homeScore = current.find((score) => (score.participant_id === home.id))?.score as Json | undefined;
    const awayScore = current.find((score) => (score.participant_id === away.id))?.score as Json | undefined;
    return { providerId: `${this.id}:${item.id}`, competition: text(league?.name) || "SportMonks Football", homeTeam: text(home.name), awayTeam: text(away.name), startsAt: new Date(text(item.starting_at) || Date.now()), status, homeScore: homeScore ? number(homeScore.goals) : undefined, awayScore: awayScore ? number(awayScore.goals) : undefined };
  }
  async getMatches() { const [from,to]=this.dates(); const response=await this.request(`/fixtures/between/${from}/${to}`,{include:"participants;league;state;scores"}); return { data: filterMatches(response.data.map((item)=>this.normalizeFixture(item))), remainingLimit: response.remainingLimit }; }
  async getOdds() { const [from,to]=this.dates(); const response=await this.request(`/fixtures/between/${from}/${to}`,{include:"participants;league;odds"}); const odds:ProviderOdd[]=response.data.flatMap((fixture)=>array(fixture.odds).filter((odd)=>number(odd.value)>1).map((odd)=>({providerEventId:`${this.id}:${fixture.id}`,market:text((odd.market as Json|undefined)?.name)||text(odd.market_id),selection:text(odd.label)||text(odd.name),odd:number(odd.value),bookmaker:`${this.id}:${text((odd.bookmaker as Json|undefined)?.name)||text(odd.bookmaker_id)}`,capturedAt:new Date(text(odd.latest_bookmaker_update)||Date.now())}))); return {data:odds,remainingLimit:response.remainingLimit}; }
  async getMarkets(){const response=await this.request("/markets");return {data:response.data.map((item)=>text(item.name)).filter(Boolean),remainingLimit:response.remainingLimit};}
  async getResults():Promise<ProviderResponse<ProviderResult[]>>{const [from,to]=this.dates();const response=await this.request(`/fixtures/between/${from}/${to}`,{include:"participants;league;state;scores"});const results:ProviderResult[]=filterMatches(response.data.map((item)=>this.normalizeFixture(item))).filter((item)=>item.status==="FINISHED"||item.status==="CANCELLED").map((item)=>({...item,status:item.status as "FINISHED"|"CANCELLED"}));return {data:results,remainingLimit:response.remainingLimit};}
}
