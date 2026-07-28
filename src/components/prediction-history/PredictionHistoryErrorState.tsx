import { TriangleAlert } from "lucide-react";

/**
 * Mesma estrutura de `PredictionErrorState.tsx` (Sprint 6.5). `message`
 * deve ser sempre uma mensagem genérica e segura (responsabilidade de
 * quem chama — nunca stack trace ou detalhe técnico interno). Botão de
 * retry só aparece quando `onRetry` é fornecido.
 */
export function PredictionHistoryErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="card p-10 text-center" role="alert">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
        <TriangleAlert size={24} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-black text-white">Não foi possível carregar o histórico de previsões</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-black uppercase text-zinc-200"
        >
          Tentar novamente
        </button>
      )}
    </section>
  );
}
