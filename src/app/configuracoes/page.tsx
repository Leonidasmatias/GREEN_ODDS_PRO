import { CheckCircle2, ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { SyncPanel } from "@/components/SyncPanel";

export default function SettingsPage() {
  return <>
    <PageTitle eyebrow="Integracoes e persistencia" title="Configuracoes" description="Monitore API, banco, sincronizacoes e modo operacional sem expor credenciais no navegador."/>
    <SyncPanel/>
    <section className="card mt-6 border-neon/20 p-6">
      <div className="flex gap-4">
        <ShieldAlert className="shrink-0 text-neon"/>
        <div>
          <h2 className="font-black">Politica de dados</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">A integracao de producao usa somente APIs licenciadas. Nenhuma chave e enviada ao cliente e nenhuma tecnica de scraping e utilizada.</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-neon"><CheckCircle2 size={14}/> Mock bloqueado em producao</div>
        </div>
      </div>
    </section>
  </>;
}
