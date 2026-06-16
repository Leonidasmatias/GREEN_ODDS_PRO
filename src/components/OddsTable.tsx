import { Radio } from "lucide-react";
import type { Game } from "@/lib/types";

function OddCell({ label, value }: { label: string; value: number }) {
  return <div title="Odd informativa do provider licenciado; sem acao de aposta" className="min-w-[74px] rounded-lg border border-gold/10 bg-gold/[.07] px-3 py-2 text-center"><span className="block text-[8px] font-black uppercase text-zinc-600">{label}</span><strong className="mt-0.5 block text-sm text-gold">{value.toFixed(2)}</strong></div>;
}

export function OddsTable({ games }: { games: Game[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line bg-white/[.018] px-5 py-4">
        <div><p className="text-xs font-black uppercase tracking-[.14em] text-white">Mercado principal</p><p className="mt-1 text-[10px] text-zinc-600">Provider ativo · Resultado final</p></div>
        <span className="rounded-full border border-neon/15 bg-neon/[.06] px-3 py-1 text-[9px] font-black uppercase text-neon">1 X 2</span>
      </div>
      {games.length ? <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[760px] text-left">
          <thead><tr className="border-b border-line text-[9px] font-black uppercase tracking-[.16em] text-zinc-600"><th className="px-5 py-3">Horario</th><th>Partida</th><th className="text-center">1</th><th className="text-center">X</th><th className="text-center">2</th><th className="px-5 text-right">Status</th></tr></thead>
          <tbody>{games.map((game) => <tr key={game.id} className="border-b border-line/70 transition last:border-0 hover:bg-white/[.02]"><td className="px-5 py-4"><strong className="text-xs text-white">{game.time}</strong><span className="mt-1 block text-[9px] text-zinc-600">{game.group}</span></td><td><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-black/20 text-[9px] font-black text-neon">{game.homeCode}</div><div><strong className="block text-xs text-white">{game.home}</strong><span className="text-[10px] text-zinc-600">vs {game.away}</span></div></div></td><td className="px-1"><OddCell label="Casa" value={game.odds.home}/></td><td className="px-1"><OddCell label="Empate" value={game.odds.draw}/></td><td className="px-1"><OddCell label="Fora" value={game.odds.away}/></td><td className="px-5 text-right">{game.status === "Ao vivo" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[9px] font-black text-red-400"><Radio size={10}/> {game.minute}</span> : <span className="text-[9px] font-bold uppercase text-zinc-500">{game.status}</span>}</td></tr>)}</tbody>
        </table>
      </div> : <div className="px-5 py-14 text-center text-sm text-zinc-600">Nenhuma partida encontrada</div>}
    </div>
  );
}
