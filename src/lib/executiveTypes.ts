export type ExecutiveStatus = "READY" | "INSUFFICIENT_REAL_DATA" | "BLOCKED";

export type ExecutiveKpi = {
  key: string;
  label: string;
  value: string | number;
  status: ExecutiveStatus;
  source: string;
  audit: string;
};

export type ExecutiveCenter = {
  status: ExecutiveStatus;
  kpis: ExecutiveKpi[];
  generatedAt: string;
};
