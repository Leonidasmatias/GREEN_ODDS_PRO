"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Radio, Search, ShieldCheck } from "lucide-react";

const navigation = [
  { href: "/live-monitor", label: "Ao Vivo", icon: Radio },
  { href: "/odds-do-dia", label: "Pre-Jogo" },
  { href: "/radar-green", label: "Radar Green" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-[#07100c]/90 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-4 px-4 md:px-7">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3 lg:hidden">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-neon/20 bg-neon/10 text-neon"><ShieldCheck size={19}/></div>
          <div className="min-w-0"><strong className="block truncate text-xs tracking-[.12em]">GREEN ODDS PRO</strong><span className="hidden text-[8px] text-zinc-600 sm:block">RADAR INTELIGENTE</span></div>
        </Link>

        <nav className="hidden h-full items-center gap-1 lg:flex">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={`${href}-${label}`} href={href} className={`flex h-full items-center gap-2 border-b-2 px-4 text-[11px] font-black uppercase tracking-wider transition ${active ? "border-neon text-neon" : "border-transparent text-zinc-500 hover:text-white"}`}>{Icon && <Icon size={13} className={label === "Ao Vivo" ? "text-red-400" : ""}/>} {label}</Link>;
          })}
        </nav>

        <div className="ml-auto hidden max-w-64 flex-1 items-center gap-2 rounded-xl border border-line bg-black/20 px-3 py-2 text-zinc-600 xl:flex"><Search size={15}/><span className="text-[10px]">Buscar jogo ou mercado</span></div>
        <button aria-label="Notificacoes indisponiveis" title="Notificacoes: PENDING_RESULTS" disabled className="ml-auto grid h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-line bg-white/[.025] text-zinc-700 lg:ml-0"><Bell size={16}/></button>
        <div className="hidden items-center gap-3 border-l border-line pl-4 sm:flex"><div className="text-right"><p className="text-[10px] font-bold text-white">Provider</p><p className="text-[9px] text-neon">Dados reais</p></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-neon text-[10px] font-black text-black">API</div></div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-t border-white/[.03] px-3 lg:hidden">{navigation.map(({href,label,icon:Icon}) => <Link key={label} href={href} className="flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500">{Icon && <Icon size={11}/>} {label}</Link>)}</div>
    </header>
  );
}
