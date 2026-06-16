export function CreatorSignature({ compact = false }: { compact?: boolean }) {
  return <section className={`rounded-xl border border-line bg-white/[.02] ${compact ? "p-4" : "p-5"} text-[11px] leading-relaxed text-zinc-500`}>
    <p className="font-black uppercase tracking-[.16em] text-zinc-400">GREEN ODDS PRO</p>
    <p className="mt-1">Inteligencia estatistica para analise de odds com dados reais.</p>
    <p className="mt-3 text-zinc-400">Criado por <b className="text-white">Leônidas Matias</b></p>
    <p>Supervisor de Telecomunicações · Engenheiro Eletricista</p>
    <p className="mt-2"><a className="text-neon" href="mailto:leonidasmatias81@gmail.com">leonidasmatias81@gmail.com</a> · <span className="text-zinc-400">+55 11 93729-9687</span></p>
  </section>;
}
