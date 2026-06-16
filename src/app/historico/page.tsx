import { PageTitle, StatCard } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const units = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}u`;

export default async function HistoryPage() {
  const tips = await prisma.tip.findMany({ include: { match: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const settled = tips.filter((item) => ["WON", "LOST", "VOID"].includes(item.status));
  const greens = tips.filter((item) => item.status === "WON").length;
  const profit = settled.reduce((sum, item) => sum + (item.profitLoss ?? 0), 0);
  const stake = settled.reduce((sum, item) => sum + item.stake, 0);
  const roi = stake ? profit / stake * 100 : 0;

  return <>
    <PageTitle eyebrow="Prestacao de contas" title="Historico de sugestoes" description="Acompanhe apenas tips registradas no banco, com liquidacao oficial e resultado auditavel."/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Sugestoes" value={tips.length.toString()} detail={`${settled.length} finalizadas`} tone="white"/>
      <StatCard label="Greens" value={greens.toString()} detail={settled.length ? `Taxa de acerto de ${(greens / settled.length * 100).toFixed(1)}%` : "Aguardando liquidacoes reais"}/>
      <StatCard label="Resultado" value={units(profit)} detail="Calculado sobre tips liquidadas"/>
      <StatCard label="ROI acumulado" value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`} detail="Desde o inicio do tracking real" tone="yellow"/>
    </div>
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-4">
        <p className="text-sm font-black uppercase tracking-wider">Registro completo</p>
        <p className="mt-1 text-[11px] text-zinc-600">Sem historico sintetico: a tabela exibe somente registros persistidos no banco.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead><tr className="border-b border-line text-[9px] uppercase tracking-wider text-zinc-600"><th className="py-4">Data</th><th>Jogo</th><th>Mercado</th><th>Odd</th><th>Selecao</th><th>Status</th><th>P/L real</th></tr></thead>
          <tbody>{tips.length ? tips.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="py-5 font-bold text-zinc-500">{new Intl.DateTimeFormat("pt-BR").format(item.createdAt)}</td><td className="font-bold">{item.match.homeTeam} x {item.match.awayTeam}</td><td className="text-zinc-400">{item.market}</td><td className="font-black">{item.odd.toFixed(2)}</td><td className="text-zinc-400">{item.selection}</td><td><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${item.status === "WON" ? "border-neon/20 bg-neon/10 text-neon" : item.status === "LOST" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>{item.status}</span></td><td className={(item.profitLoss ?? 0) > 0 ? "font-black text-neon" : (item.profitLoss ?? 0) < 0 ? "font-black text-red-400" : "text-zinc-500"}>{item.profitLoss == null ? "-" : units(item.profitLoss)}</td></tr>) : <tr><td colSpan={7} className="py-12 text-center text-zinc-600">Nenhuma tip real registrada ainda.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </>;
}
