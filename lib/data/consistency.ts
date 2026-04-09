import "server-only";

export function ensureConsistency<T>(data: T | null | undefined): T {
  if (data === null || data === undefined) {
    throw {
      code: "DATA_INCONSISTENT",
      message: "Missing data",
      source: "data",
      severity: "high" as const,
    };
  }

  return data;
}
