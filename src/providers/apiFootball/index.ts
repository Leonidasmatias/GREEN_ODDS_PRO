import { filterMatches } from "../competitionFilter";
import type { OddsProvider, ProviderMatch, ProviderOdd, ProviderResponse, ProviderResult } from "../types";

type Json = Record<string, unknown>;
const array = (value: unknown) => Array.isArray(value) ? value as Json[] : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => Number(value ?? 0);

export class ApiFootballProvider implements OddsProvider {
  readonly id = "api-football";
  readonly licensed = true;
  isConfigured() { return Boolean(process.env.FOOTBALL_API_KEY?.trim()); }
  private async request(path: string, params: Record<string,string>={}):Promise<ProviderResponse<Json[]>>{
    const key=process.env.FOOTBALL_API_KEY?.trim();if(!key)throw new Error("FOOTBALL_API_KEY não configurada");
    const url=new URL(`${process.env.API_FOOTBALL_BASE_URL?.trim()||"https://v3.football.api-sports.io"}${path}`);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    const response=await fetch(url,{cache:"no-store",headers:{"x-apisports-key":key},signal:AbortSignal.timeout(12_000)});if(!response.ok)throw new Error(`API-Football HTTP ${response.status}`);
    const body=await response.json() as {response?:Json[]};return{data:body.response??[],remainingLimit:Number(response.headers.get("x-ratelimit-requests-remaining")??"")||undefined};
  }
  private date(){return new Date().toISOString().slice(0,10);}
  private normalize(item:Json):ProviderMatch{const fixture=item.fixture as Json|undefined;const league=item.league as Json|undefined;const teams=item.teams as Json|undefined;const goals=item.goals as Json|undefined;const status=text((fixture?.status as Json|undefined)?.short);return{providerId:`${this.id}:${fixture?.id}`,competition:text(league?.name)||"API-Football",homeTeam:text((teams?.home as Json|undefined)?.name),awayTeam:text((teams?.away as Json|undefined)?.name),startsAt:new Date(text(fixture?.date)||Date.now()),status:["FT","AET","PEN"].includes(status)?"FINISHED":["1H","HT","2H","ET","BT","P"].includes(status)?"LIVE":["CANC","ABD","AWD","WO"].includes(status)?"CANCELLED":"PRE_GAME",homeScore:goals?.home==null?undefined:number(goals.home),awayScore:goals?.away==null?undefined:number(goals.away)};}
  async getMatches(){const response=await this.request("/fixtures",{date:this.date()});return{data:filterMatches(response.data.map((item)=>this.normalize(item))),remainingLimit:response.remainingLimit};}
  async getOdds(){const response=await this.request("/odds",{date:this.date()});const odds:ProviderOdd[]=response.data.flatMap((item)=>{const fixture=item.fixture as Json|undefined;return array(item.bookmakers).flatMap((bookmaker)=>array(bookmaker.bets).flatMap((bet)=>array(bet.values).filter((value)=>number(value.odd)>1).map((value)=>({providerEventId:`${this.id}:${fixture?.id}`,market:text(bet.name),selection:text(value.value),odd:number(value.odd),bookmaker:`${this.id}:${text(bookmaker.name)}`,capturedAt:new Date()}))))});return{data:odds,remainingLimit:response.remainingLimit};}
  async getMarkets(){return{data:["Match Winner","Goals Over/Under","Both Teams Score","Double Chance","Asian Handicap"]};}
  async getResults():Promise<ProviderResponse<ProviderResult[]>>{const response=await this.request("/fixtures",{date:this.date(),status:"FT-AET-PEN"});const results:ProviderResult[]=filterMatches(response.data.map((item)=>this.normalize(item))).filter((item)=>item.status==="FINISHED"||item.status==="CANCELLED").map((item)=>({...item,status:item.status as "FINISHED"|"CANCELLED"}));return{data:results,remainingLimit:response.remainingLimit};}
}
