import { ArrowUpRight, ChevronRight, Clock3, Radio, Shield, Target, TrendingUp } from "lucide-react";
import type { Game } from "@/lib/types";

export const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="label mb-2 text-neon">{eyebrow}</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p></div>{action}</div>;
}

export function StatCard({ label, value, detail, tone = "green" }: { label: string; value: string; detail: string; tone?: "green" | "yellow" | "white" }) {
  const colors = { green: "text-neon", yellow: "text-amber-300", white: "text-white" };
  return <div className="card p-5"><div className="flex items-start justify-between"><p className="label">{label}</p><TrendingUp size={16} className={colors[tone]}/></div><p className={`mt-3 text-3xl font-black tracking-tight ${colors[tone]}`}>{value}</p><p className="mt-1 text-[11px] text-zinc-600">{detail}</p></div>;
}

export function GamesList({ items }: { items: Game[] }) {
  return <div className="space-y-2">{items.map(game => <div key={game.id} className="grid items-center gap-4 rounded-xl border border-transparent bg-white/[.025] p-4 transition hover:border-line hover:bg-white/[.04] md:grid-cols-[100px_1fr_auto]">
    <div><div className="flex items-center gap-2 text-xs font-black"><Clock3 size={13} className="text-zinc-600"/>{game.time}</div><p className="mt-1 text-[10px] text-zinc-600">{game.group}</p></div>
    <div><div className="flex items-center gap-3"><span className="w-9 text-[10px] font-black text-zinc-500">{game.homeCode}</span><b className="text-sm">{game.home}</b></div><div className="mt-2 flex items-center gap-3"><span className="w-9 text-[10px] font-black text-zinc-500">{game.awayCode}</span><b className="text-sm">{game.away}</b></div></div>
    <div className="flex items-center justify-between gap-2 md:justify-end">{game.status === "Ao vivo" && <span className="mr-2 flex items-center gap-1 text-[10px] font-black text-red-400"><Radio size={12}/> AO VIVO {game.minute}</span>}{Object.entries(game.odds).map(([key, odd]) => <div key={key} className="min-w-14 rounded-lg border border-line bg-ink px-3 py-2 text-center"><p className="text-[8px] font-bold uppercase text-zinc-600">{key === "home" ? "1" : key === "draw" ? "X" : "2"}</p><b className="text-xs">{odd.toFixed(2)}</b></div>)}<ChevronRight size={16} className="text-zinc-700"/></div>
  </div>)}</div>;
}

export function SectionHeader({ title, detail, href }: { title: string; detail?: string; href?: string }) {
  return <div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-black uppercase tracking-wider">{title}</p>{detail && <p className="mt-1 text-[11px] text-zinc-600">{detail}</p>}</div>{href && <a href={href} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neon">Ver tudo <ArrowUpRight size={13}/></a>}</div>;
}

export function ConfidenceRing({ value }: { value: number }) { return <div className="relative grid h-24 w-24 place-items-center rounded-full" style={{background:`conic-gradient(#42f58d ${value}%, #1c2922 0)`}}><div className="grid h-20 w-20 place-items-center rounded-full bg-panel"><div className="text-center"><b className="text-xl">{value}%</b><p className="text-[8px] uppercase text-zinc-600">confiança</p></div></div></div>; }

export const icons = { Target, Shield };
