import { Mail, Phone, ShieldCheck } from "lucide-react";
import { CreatorSignature } from "@/components/CreatorSignature";

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return <>
    <div className="mb-7">
      <p className="label mb-2 text-neon">Institucional</p>
      <h1 className="text-3xl font-black md:text-4xl">GREEN ODDS PRO</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">Plataforma de inteligencia estatistica para analise de odds esportivas baseada exclusivamente em dados reais provenientes de provedores licenciados.</p>
    </div>

    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <div className="card p-6">
        <ShieldCheck className="text-neon" size={22}/>
        <p className="label mt-5">Status atual</p>
        <h2 className="mt-2 text-2xl font-black">Producao ativa no Railway</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">Fases 17 a 28 implantadas. O sistema permanece aguardando crescimento organico da base real de resultados WON/LOST/VOID para fortalecer ranking, confidence, ML e estrategias adaptativas.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {["PostgreSQL Railway operacional", "The Odds API ativa", "RESULT_SYNC implementado", "Phase 29 planejada"].map((item) => <div className="rounded-xl border border-line p-4 text-xs font-bold text-zinc-300" key={item}>{item}</div>)}
        </div>
      </div>
      <div className="card p-6">
        <p className="label">Criador</p>
        <h2 className="mt-2 text-2xl font-black">Leônidas Matias</h2>
        <p className="mt-3 text-sm text-zinc-500">Supervisor de Telecomunicações</p>
        <p className="text-sm text-zinc-500">Engenheiro Eletricista</p>
        <div className="mt-6 space-y-3 text-sm">
          <a className="flex items-center gap-3 rounded-xl border border-line p-3 text-neon" href="mailto:leonidasmatias81@gmail.com"><Mail size={16}/>leonidasmatias81@gmail.com</a>
          <p className="flex items-center gap-3 rounded-xl border border-line p-3 text-zinc-300"><Phone size={16}/>+55 11 93729-9687</p>
        </div>
      </div>
    </section>

    <div className="mt-6"><CreatorSignature/></div>
  </>;
}
