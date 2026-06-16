export type ConfidenceLevel = "MÍNIMA" | "BAIXA" | "MÉDIA" | "ALTA" | "MUITO ALTA";

export function getDataConfidence(records: number) {
  if (records >= 5000) return { level: "MUITO ALTA" as ConfidenceLevel, factor: 1, percentage: 100 };
  if (records >= 1000) return { level: "ALTA" as ConfidenceLevel, factor: 0.85, percentage: 85 };
  if (records >= 500) return { level: "MÉDIA" as ConfidenceLevel, factor: 0.65, percentage: 65 };
  if (records >= 100) return { level: "BAIXA" as ConfidenceLevel, factor: 0.4, percentage: 40 };
  return { level: "MÍNIMA" as ConfidenceLevel, factor: records ? 0.1 : 0, percentage: records ? 10 : 0 };
}
