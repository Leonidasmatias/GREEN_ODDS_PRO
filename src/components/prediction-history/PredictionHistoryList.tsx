"use client";

import { formatReportDate } from "@/lib/predictionCenterFormatters";
import type { PredictionSummary } from "@/lib/predictionApiClient";
import { formatMatchParticipant, formatPredictionCombinedStatus, formatPredictionGreenScoreCategory, formatPredictionSource } from "@/lib/predictionHistoryFormatters";
import { greenScoreCategoryStyles } from "@/components/prediction/predictionStatusStyles";
import { resolveDataSufficiencyStyle, resolveGreenScoreStyle } from "./predictionHistoryStyles";

function SkeletonRow({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[.03] ${className}`} aria-hidden="true" />;
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${className}`}>{label}</span>;
}

function MatchLabel({ item }: { item: PredictionSummary }) {
  const home = formatMatchParticipant(item.virtualTeamHome, item.homePlayerId);
  const away = formatMatchParticipant(item.virtualTeamAway, item.awayPlayerId);
  return (
    <span>
      <b className="text-white">{home}</b> <span className="text-zinc-600">vs</span> <b className="text-white">{away}</b>
    </span>
  );
}

/** Listagem responsiva: tabela no desktop, cards no mobile — mesmos
 * dados, nunca busca `PredictionDetail` por item (evita N+1). */
export function PredictionHistoryList({
  items,
  loading,
  onOpenDetail,
  onOpenTimeline,
}: {
  items: PredictionSummary[];
  loading: boolean;
  onOpenDetail: (id: string) => void;
  onOpenTimeline: (matchId: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando previsões">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonRow key={index} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <table className="hidden w-full text-left text-xs md:table">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wide text-zinc-500">
            <th scope="col" className="py-3 pr-3">Partida</th>
            <th scope="col" className="py-3 pr-3">Liga / Período</th>
            <th scope="col" className="py-3 pr-3">Gerada em</th>
            <th scope="col" className="py-3 pr-3">Green Score</th>
            <th scope="col" className="py-3 pr-3">Status</th>
            <th scope="col" className="py-3 pr-3">Origem</th>
            <th scope="col" className="py-3 pr-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-line/60">
              <td className="py-3 pr-3"><MatchLabel item={item} /></td>
              <td className="py-3 pr-3 text-zinc-400">{item.league ?? "-"} {item.period ? `· ${item.period}` : ""}</td>
              <td className="py-3 pr-3 text-zinc-400">{formatReportDate(item.generatedAt)}</td>
              <td className="py-3 pr-3">
                <Badge label={formatPredictionGreenScoreCategory(item.greenScoreCategory)} className={resolveGreenScoreStyle(item.greenScoreCategory, greenScoreCategoryStyles)} />
              </td>
              <td className="py-3 pr-3">
                <Badge label={formatPredictionCombinedStatus(item.combinedStatus)} className={resolveDataSufficiencyStyle(item.combinedStatus)} />
              </td>
              <td className="py-3 pr-3 text-zinc-400">{formatPredictionSource(item.source)}</td>
              <td className="py-3 pr-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => onOpenDetail(item.id)} className="rounded-lg border border-line bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase text-zinc-200">
                    Detalhes
                  </button>
                  <button type="button" onClick={() => onOpenTimeline(item.matchId)} className="rounded-lg border border-line bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase text-zinc-200">
                    Timeline
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <div key={item.id} className="card p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <MatchLabel item={item} />
            </div>
            <p className="mt-1 text-zinc-500">{item.league ?? "-"} {item.period ? `· ${item.period}` : ""}</p>
            <p className="mt-1 text-zinc-500">{formatReportDate(item.generatedAt)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge label={formatPredictionGreenScoreCategory(item.greenScoreCategory)} className={resolveGreenScoreStyle(item.greenScoreCategory, greenScoreCategoryStyles)} />
              <Badge label={formatPredictionCombinedStatus(item.combinedStatus)} className={resolveDataSufficiencyStyle(item.combinedStatus)} />
              <span className="text-[10px] uppercase text-zinc-500">{formatPredictionSource(item.source)}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => onOpenDetail(item.id)} className="flex-1 rounded-lg border border-line bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase text-zinc-200">
                Detalhes
              </button>
              <button type="button" onClick={() => onOpenTimeline(item.matchId)} className="flex-1 rounded-lg border border-line bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase text-zinc-200">
                Timeline
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
