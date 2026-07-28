"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Search } from "lucide-react";
import type { ProfileRowViewModel } from "@/lib/intelligenceTypes";
import {
  DEFAULT_PROFILE_TABLE_FILTERS,
  filterProfileRows,
  sortProfileRows,
  type ProfileTableFilters,
  type ProfileTableSortDirection,
  type ProfileTableSortKey,
} from "@/lib/intelligenceProfileTableUtils";
import { monitoringStatusStyles, riskLevelStyles } from "./intelligenceStatusStyles";

function uniqueOptions<T>(values: (T | null)[]): T[] {
  return Array.from(new Set(values.filter((value): value is T => value !== null)));
}

const SORT_OPTIONS: { key: ProfileTableSortKey; label: string }[] = [
  { key: "reliability", label: "Confiabilidade" },
  { key: "risk", label: "Risco" },
  { key: "driftCount", label: "Sinais de drift" },
  { key: "name", label: "Nome do perfil" },
];

export function ProfileMonitoringTable({ rows }: { rows: ProfileRowViewModel[] }) {
  const [filters, setFilters] = useState<ProfileTableFilters>(DEFAULT_PROFILE_TABLE_FILTERS);
  const [sortKey, setSortKey] = useState<ProfileTableSortKey>("risk");
  const [sortDirection, setSortDirection] = useState<ProfileTableSortDirection>("desc");

  const dimensionOptions = useMemo(() => uniqueOptions(rows.map((row) => row.dimensionCode)), [rows]);
  const statusOptions = useMemo(() => uniqueOptions(rows.map((row) => row.status)), [rows]);
  const riskOptions = useMemo(() => uniqueOptions(rows.map((row) => row.riskCode)), [rows]);
  const recommendationOptions = useMemo(() => uniqueOptions(rows.map((row) => row.recommendationCode)), [rows]);
  const trendOptions = useMemo(() => uniqueOptions(rows.map((row) => row.trendCode)), [rows]);

  const dimensionLabelByCode = useMemo(() => new Map(rows.map((row) => [row.dimensionCode, row.dimensionLabel])), [rows]);
  const recommendationLabelByCode = useMemo(() => new Map(rows.filter((r) => r.recommendationCode).map((row) => [row.recommendationCode, row.recommendationLabel])), [rows]);
  const riskLabelByCode = useMemo(() => new Map(rows.filter((r) => r.riskCode).map((row) => [row.riskCode, row.riskLabel])), [rows]);
  const trendLabelByCode = useMemo(() => new Map(rows.filter((r) => r.trendCode).map((row) => [row.trendCode, row.trendLabel])), [rows]);
  const statusLabelByCode = useMemo(() => new Map(rows.map((row) => [row.status, row.statusLabel])), [rows]);

  const visibleRows = useMemo(() => {
    const filtered = filterProfileRows(rows, filters);
    return sortProfileRows(filtered, sortKey, sortDirection);
  }, [rows, filters, sortKey, sortDirection]);

  function updateFilter<K extends keyof ProfileTableFilters>(key: K, value: ProfileTableFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="profiles-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
        <div>
          <p id="profiles-heading" className="text-sm font-black uppercase tracking-wider">Monitoramento de perfis</p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {visibleRows.length} de {rows.length} perfil(is) exibido(s)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b border-line bg-black/10 p-5">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="profile-search" className="label mb-1.5 block">Buscar perfil</label>
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
            <input
              id="profile-search"
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Nome ou chave do perfil"
              className="w-full rounded-xl border border-line bg-white/[.03] py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 focus:border-neon/50 focus:outline-none"
            />
          </div>
        </div>

        <FilterSelect
          id="filter-dimension"
          label="Dimensão"
          value={filters.dimension}
          onChange={(value) => updateFilter("dimension", value as ProfileTableFilters["dimension"])}
          options={dimensionOptions.map((code) => ({ value: code, label: dimensionLabelByCode.get(code) ?? code }))}
        />
        <FilterSelect
          id="filter-status"
          label="Status"
          value={filters.status}
          onChange={(value) => updateFilter("status", value as ProfileTableFilters["status"])}
          options={statusOptions.map((code) => ({ value: code, label: statusLabelByCode.get(code) ?? code }))}
        />
        <FilterSelect
          id="filter-risk"
          label="Risco"
          value={filters.risk}
          onChange={(value) => updateFilter("risk", value as ProfileTableFilters["risk"])}
          options={riskOptions.map((code) => ({ value: code, label: riskLabelByCode.get(code) ?? code }))}
          includeNoneOption
        />
        <FilterSelect
          id="filter-recommendation"
          label="Recomendação"
          value={filters.recommendation}
          onChange={(value) => updateFilter("recommendation", value as ProfileTableFilters["recommendation"])}
          options={recommendationOptions.map((code) => ({ value: code, label: recommendationLabelByCode.get(code) ?? code }))}
          includeNoneOption
        />
        <FilterSelect
          id="filter-trend"
          label="Tendência"
          value={filters.trend}
          onChange={(value) => updateFilter("trend", value as ProfileTableFilters["trend"])}
          options={trendOptions.map((code) => ({ value: code, label: trendLabelByCode.get(code) ?? code }))}
          includeNoneOption
        />

        <div>
          <label htmlFor="sort-key" className="label mb-1.5 block">Ordenar por</label>
          <div className="flex items-center gap-1.5">
            <select
              id="sort-key"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as ProfileTableSortKey)}
              className="rounded-xl border border-line bg-white/[.03] px-3 py-2.5 text-xs text-white focus:border-neon/50 focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
              aria-label={sortDirection === "asc" ? "Ordem crescente, clique para inverter" : "Ordem decrescente, clique para inverter"}
              className="rounded-xl border border-line bg-white/[.03] p-2.5 text-zinc-300 hover:text-white focus:border-neon/50 focus:outline-none"
            >
              {sortDirection === "asc" ? <ArrowUpAZ size={15} aria-hidden="true" /> : <ArrowDownAZ size={15} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[1180px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[9px] uppercase tracking-[.15em] text-zinc-600">
              <th scope="col" className="px-5 py-4">Dimensão</th>
              <th scope="col">Perfil</th>
              <th scope="col">Status</th>
              <th scope="col">Confiabilidade</th>
              <th scope="col">Sinais de drift</th>
              <th scope="col">Recomendação</th>
              <th scope="col">Risco</th>
              <th scope="col">Multiplicador sugerido</th>
              <th scope="col">Estratégia</th>
              <th scope="col">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 transition hover:bg-white/[.025]">
                  <td className="px-5 py-4 text-zinc-400">{row.dimensionLabel}</td>
                  <td className="font-bold text-white">{row.key}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${monitoringStatusStyles[row.status]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="text-zinc-300">{row.reliabilityLabel}</td>
                  <td className="text-zinc-300">{row.driftSignalsCount}</td>
                  <td className="text-zinc-300">{row.recommendationLabel}</td>
                  <td>
                    {row.riskCode ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${riskLevelStyles[row.riskCode]}`}>
                        {row.riskLabel}
                      </span>
                    ) : (
                      <span className="text-zinc-600">{row.riskLabel}</span>
                    )}
                  </td>
                  <td className="text-zinc-300">{row.suggestedMultiplierLabel}</td>
                  <td className="text-zinc-500">{row.strategyStatus}</td>
                  <td className="text-zinc-300">{row.trendLabel}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-5 py-14 text-center text-sm text-zinc-600">
                  Nenhum perfil corresponde aos filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  includeNoneOption = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: T | "ALL" | "NONE") => void;
  options: { value: T; label: string }[];
  includeNoneOption?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 block">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T | "ALL" | "NONE")}
        className="rounded-xl border border-line bg-white/[.03] px-3 py-2.5 text-xs text-white focus:border-neon/50 focus:outline-none"
      >
        <option value="ALL">Todos</option>
        {includeNoneOption && <option value="NONE">Não atribuído</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
