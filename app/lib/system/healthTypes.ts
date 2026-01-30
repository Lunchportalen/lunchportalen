// lib/system/healthTypes.ts
export type HealthStatus = "ok" | "fail" | "warn" | "skip";

export type HealthCheck = {
  key: string;
  label: string;
  status: HealthStatus;
  message: string;
  ms?: number; // målt varighet per sjekk
  detail?: any;
};

export type HealthReport = {
  ok: boolean;
  deep: boolean;
  timestamp: string; // ISO
  todayOslo: string; // YYYY-MM-DD
  checks: HealthCheck[];
};
