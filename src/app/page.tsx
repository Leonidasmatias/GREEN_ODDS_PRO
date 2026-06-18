import Link from "next/link";
import { ShieldCheck, TrendingUp, TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default function Home() {
  console.log("[HOME] step 1 render start");
  console.log("[HOME] step 2 static public content ready");
  console.log("[HOME] step 3 render complete");

  return <main className="mx-auto max-w-6xl px-4 py-12 md:py-20">
    <section className="grid gap-8 md:grid-cols-[1.1fr_.9fr] md:items-center">
      <div><p className="label mb-3 text-neon">GREEN ODDS PRO</p><h1 className="text-4xl font-black tracking-tight md:text-6xl">Inteligencia estatistica para odds reais.</h1><p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400">Radar Green, Odds do Dia, Green AI Report e Command Center com protecao por plano, auditoria e dados reais persistidos.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="rounded-xl bg-neon px-6 py-3 text-xs font-black uppercase text-[#041008]">Criar conta</Link><Link href="/pricing" className="rounded-xl border border-line bg-white/[.03] px-6 py-3 text-xs font-black uppercase text-white">Ver planos</Link></div></div>
      <div className="card p-6"><ShieldCheck className="text-neon"/><p className="mt-4 text-lg font-black">Acesso seguro por assinatura</p><p className="mt-2 text-sm text-zinc-500">FREE, PRO e PREMIUM preparados para pagamento futuro. Nenhuma senha em texto puro; sessoes persistidas em banco.</p><div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-xs text-amber-200"><TriangleAlert size={14} className="mr-2 inline"/>O Green Odds Pro nao garante lucro. Analises sao informativas e apostas envolvem risco financeiro.</div></div>
    </section>
    <section className="mt-12 grid gap-4 md:grid-cols-3">{["Dados reais", "Controle por plano", "Auditoria"].map((item) => <div key={item} className="card p-5"><TrendingUp className="text-gold"/><b className="mt-4 block">{item}</b><p className="mt-2 text-xs text-zinc-500">Sem mock, sem dados sinteticos e com bloqueios server-side.</p></div>)}</section>
  </main>;
}
