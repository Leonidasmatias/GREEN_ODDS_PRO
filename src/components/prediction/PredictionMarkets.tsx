import type { PredictionCenterViewModel } from "@/lib/predictionCenterTypes";

/**
 * Grade de mercados (1X2, Over 1.5, Over 2.5, BTTS) com a probabilidade
 * já formatada pelo Adapter. Um mercado indisponível chega com
 * `probabilityLabel` já em "Não disponível" — este componente nunca
 * oculta a linha nem converte para zero, apenas exibe o texto recebido.
 */
export function PredictionMarkets({ markets }: { markets: PredictionCenterViewModel["markets"] }) {
  return (
    <section className="card overflow-hidden" aria-labelledby="prediction-markets-heading">
      <div className="border-b border-line p-5">
        <p id="prediction-markets-heading" className="text-sm font-black uppercase tracking-wider">Mercados</p>
        <p className="mt-1 text-[10px] text-zinc-600">Probabilidade estimada pelo modelo para cada mercado</p>
      </div>
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[9px] uppercase tracking-[.15em] text-zinc-600">
              <th scope="col" className="px-5 py-4">Mercado</th>
              <th scope="col">Probabilidade</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr key={market.code} className="border-b border-line/60 transition hover:bg-white/[.025]">
                <td className="px-5 py-4 font-bold text-white">{market.label}</td>
                <td className="text-zinc-300">{market.probabilityLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
