import { TriangleAlert } from "lucide-react";

/**
 * Estado de erro do dashboard. `message` deve ser sempre uma mensagem
 * genérica e segura para o usuário final — nunca um stack trace ou
 * detalhe técnico interno (essa responsabilidade é de quem chama este
 * componente, nunca dele mesmo).
 */
export function IntelligenceErrorState({ message }: { message: string }) {
  return (
    <section className="card p-10 text-center" role="alert">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
        <TriangleAlert size={24} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-black text-white">Não foi possível carregar o painel</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{message}</p>
    </section>
  );
}
