import { Activity, AlertTriangle, Database, Radio } from "lucide-react";
import { getProvidersStatus } from "@/providers/providerManager";
import { formatDateTimeBrt } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const date = (value: string | null) => formatDateTimeBrt(value, "-");

export default async function AdminProvidersPage() {
  const data = await getProvidersStatus();

  return <>
    <div className="mb-7">
      <p className="label mb-2 text-neon">Admin providers</p>
      <h1 className="text-3xl font-black md:text-4xl">Painel de providers</h1>
      <p className="mt-2 text-sm text-zinc-500">Status operacional dos providers reais, sem exposicao de chaves.</p>
    </div>

    {data.exhaustedWarning && <div className="mb-6 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-xs text-amber-200">
      <AlertTriangle size={16} className="shrink-0"/>
      <span>{data.exhaustedWarning}</span>
    </div>}

    <div className="grid gap-4 md:grid-cols-4">
      <div className="card p-5"><Radio size={17} className="text-neon"/><p className="label mt-4">Provider ativo</p><strong className="mt-2 block text-lg">{data.activeProvider}</strong></div>
      <div className="card p-5"><Activity size={17} className="text-neon"/><p className="label mt-4">Configurados</p><strong className="mt-2 block text-lg">{data.configuredProviders.length}</strong></div>
      <div className="card p-5"><Database size={17} className="text-gold"/><p className="label mt-4">Prioridade</p><strong className="mt-2 block text-xs">{data.priority.join(" -> ")}</strong></div>
      <div className="card p-5"><AlertTriangle size={17} className={data.providerExhausted ? "text-amber-300" : "text-neon"}/><p className="label mt-4">Exaustao</p><strong className="mt-2 block text-lg">{data.providerExhausted ? "SIM" : "NAO"}</strong></div>
    </div>

    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line p-5"><p className="text-sm font-black uppercase">Providers reais</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Provider</th><th>Configurado</th><th>Status</th><th>Esgotado</th><th>Creditos</th><th>Chamadas</th><th>Falhas</th><th>Ultima chamada</th><th>Erro seguro</th></tr></thead>
          <tbody>{data.providers.map((provider) => <tr key={provider.id} className="border-b border-line/60">
            <td className="px-5 py-4 font-black">{provider.id}</td>
            <td>{provider.configured ? "SIM" : "NAO"}</td>
            <td className={provider.status === "SUCCESS" || provider.status === "READY" ? "text-neon" : provider.status === "EXHAUSTED" ? "text-amber-300" : "text-zinc-400"}>{provider.status}</td>
            <td>{provider.exhausted ? "SIM" : "NAO"}</td>
            <td>{provider.remainingLimit ?? "-"}</td>
            <td>{provider.callsMade}</td>
            <td>{provider.failures}</td>
            <td>{date(provider.lastCall)}</td>
            <td className="max-w-[280px] truncate">{provider.lastError ?? "-"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}
