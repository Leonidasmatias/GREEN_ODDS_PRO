import { Database, HardDrive, HeartPulse, Radio, Timer } from "lucide-react";
import { getHealthStatus } from "@/services/productionOperationsService";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const data = await getHealthStatus();
  const icons = [Database, Radio, Radio, Timer, HardDrive, HeartPulse];
  const border = data.status === "RED" ? "border-red-400/20" : data.status === "YELLOW" ? "border-amber-300/20" : "border-neon/20";

  return <>
    <div className="mb-7">
      <p className="label mb-2 text-neon">Health check</p>
      <h1 className="text-3xl font-black md:text-4xl">Saude da plataforma</h1>
      <p className="mt-2 text-sm text-zinc-500">Estado real das dependencias operacionais.</p>
    </div>
    <div className={`card mb-6 flex items-center gap-4 p-5 ${border}`}>
      <HeartPulse/>
      <div><p className="label">Status geral</p><strong className="text-2xl">{data.status}</strong></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {data.checks.map((check, index) => {
        const Icon = icons[index] ?? HeartPulse;
        return <div className="card p-5" key={check.name}>
          <Icon size={18} className={check.status === "GREEN" ? "text-neon" : check.status === "YELLOW" ? "text-amber-300" : "text-red-400"}/>
          <p className="label mt-4">{check.name}</p>
          <strong className="mt-2 block">{check.status}</strong>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{check.detail}</p>
        </div>;
      })}
    </div>
    <div className="mt-6 rounded-xl border border-line p-4 text-[11px] text-zinc-500">Este painel monitora infraestrutura. Nao promete lucro nem garante resultados esportivos.</div>
  </>;
}
