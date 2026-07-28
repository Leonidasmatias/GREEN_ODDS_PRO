// Mapeamento centralizado de tom visual (cor) por status técnico —
// única fonte de verdade para todos os badges do dashboard de
// inteligência, nunca duplicado por componente. Cor nunca é a única
// forma de transmitir a informação: todo badge que consome este mapa
// também exibe o rótulo textual correspondente.

import type { AlertLevel, MonitoringStatus } from "@/services/prediction-observability";
import type { RiskLevel, StrategyStatus } from "@/lib/intelligenceTypes";

export const strategyStatusStyles: Record<StrategyStatus, string> = {
  NORMAL: "border-neon/30 bg-neon/10 text-neon",
  WATCH: "border-amber-300/30 bg-amber-300/10 text-amber-300",
  WARNING: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-400",
};

export const monitoringStatusStyles: Record<MonitoringStatus, string> = {
  STABLE: "border-neon/25 bg-neon/10 text-neon",
  IMPROVING: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  WARNING: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  CRITICAL: "border-red-500/25 bg-red-500/10 text-red-400",
  DISABLED: "border-zinc-500/25 bg-zinc-500/10 text-zinc-400",
  NEW: "border-gold/25 bg-gold/10 text-gold",
};

export const riskLevelStyles: Record<RiskLevel, string> = {
  LOW: "border-neon/25 bg-neon/10 text-neon",
  MEDIUM: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  HIGH: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  CRITICAL: "border-red-500/25 bg-red-500/10 text-red-400",
};

export const alertLevelStyles: Record<AlertLevel, string> = {
  INFO: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  WARNING: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  CRITICAL: "border-red-500/25 bg-red-500/10 text-red-400",
};
