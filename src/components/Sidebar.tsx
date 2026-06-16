"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BrainCircuit, CalendarDays, Command, Crosshair, Database, FileBarChart, FileCheck2, FlaskConical, Gauge, HeartPulse, History, Layers3, LockKeyhole, Radio, Rocket, Settings, ShieldCheck, Sparkles, Timer, Trophy } from "lucide-react";

const links = [
  ["/command-center", "Command Center", Command],
  ["/green-ai", "Green AI", BrainCircuit],
  ["/green-ai-report", "Relatorio AI", FileBarChart],
  ["/model-performance", "Performance ML", Activity],
  ["/jobs", "Jobs", Timer],
  ["/health", "Health", HeartPulse],
  ["/live-monitor", "Ao Vivo", Radio],
  ["/readiness", "Readiness", Gauge],
  ["/go-live", "Go Live", Rocket],
  ["/production-certificate", "Certificacao", ShieldCheck],
  ["/admin", "Admin", LockKeyhole],
  ["/coverage", "Cobertura", Radio],
  ["/season-analytics", "Temporada", Trophy],
  ["/dashboard", "Dashboard", CalendarDays],
  ["/radar-green", "Radar Green", Crosshair],
  ["/top-green", "Top 10 Green", Trophy],
  ["/odds-do-dia", "Pre-Jogo", Sparkles],
  ["/multiplas", "Multiplas", Layers3],
  ["/historico", "Historico", History],
  ["/performance", "Performance", Activity],
  ["/green-lab", "Green Lab", FlaskConical],
  ["/audit", "Auditoria", FileCheck2],
  ["/audit/data", "Auditoria Dados", Database],
  ["/configuracoes", "Configuracoes", Settings],
] as const;

export function Sidebar() {
  const path = usePathname();
  return <aside className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-[#07100c]/95 px-2 py-2 backdrop-blur-2xl lg:bottom-auto lg:right-auto lg:top-0 lg:h-screen lg:w-[272px] lg:border-r lg:border-t-0 lg:px-5 lg:py-6">
    <div className="hidden items-center gap-3 border-b border-line px-2 pb-6 lg:flex">
      <div className="relative grid h-11 w-11 place-items-center rounded-xl border border-neon/25 bg-gradient-to-br from-neon/20 to-transparent text-neon"><Crosshair size={22} /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#07100c] bg-gold"/></div>
      <div><p className="text-sm font-black tracking-[.14em] text-white">GREEN ODDS</p><p className="text-[9px] font-black tracking-[.36em] text-neon">PRO</p></div>
    </div>
    <div className="mt-6 hidden rounded-xl border border-line bg-black/20 p-3 lg:flex lg:items-center lg:gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-neon/10 text-neon"><Radio size={15}/></div><div><p className="text-[10px] font-black text-white">PROVIDER ATIVO</p><p className="text-[9px] text-zinc-600">feed licenciado</p></div></div>
    <p className="label mb-3 mt-7 hidden px-3 lg:block">Navegacao</p>
    <nav className="flex justify-start gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
      {links.map(([href, label, Icon]) => { const active = path === href; return <Link key={`${href}-${label}`} href={href} title={label} className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold transition ${active ? "bg-neon/[.09] text-neon" : "text-zinc-500 hover:bg-white/[.035] hover:text-white"}`}>{active && <span className="absolute left-0 h-5 w-0.5 rounded-full bg-neon"/>}<Icon size={17}/><span className="hidden lg:inline">{label}</span></Link>; })}
    </nav>
    <div className="mt-auto hidden rounded-2xl border border-line bg-gradient-to-br from-white/[.035] to-transparent p-4 lg:absolute lg:bottom-6 lg:left-5 lg:right-5 lg:block">
      <p className="label">GREEN ODDS PRO</p><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Radar inteligente para odds reais de providers licenciados.</p><div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[9px] font-bold text-neon"><span className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_10px_#45e68a]"/> DADOS REAIS</div>
    </div>
  </aside>;
}
