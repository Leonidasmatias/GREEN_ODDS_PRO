import { HeartPulse } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HealthPage() {
  return <>
    <div className="mb-7">
      <p className="label mb-2 text-neon">Health check</p>
      <h1 className="text-3xl font-black md:text-4xl">Servidor online</h1>
      <p className="mt-2 text-sm text-zinc-500">Endpoint leve para healthcheck de boot, sem dependencia de autenticacao ou consultas operacionais.</p>
    </div>
    <div className="card mb-6 flex items-center gap-4 border-neon/20 p-5">
      <HeartPulse className="text-neon"/>
      <div>
        <p className="label">Status geral</p>
        <strong className="text-2xl">OK</strong>
      </div>
    </div>
    <div className="rounded-xl border border-line p-4 text-[11px] text-zinc-500">Este healthcheck confirma apenas que o processo HTTP respondeu. Auditorias operacionais completas permanecem nos endpoints dedicados.</div>
  </>;
}
