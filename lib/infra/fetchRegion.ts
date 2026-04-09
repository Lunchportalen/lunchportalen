import "server-only";

import { getRegion } from "@/lib/infra/region";

const REGION_FETCH_FAILED = {
  code: "REGION_FETCH_FAILED",
  message: "Request failed",
  source: "infra",
  severity: "high" as const,
};

/**
 * fetch med x-region header. Fail-closed ved !res.ok.
 */
export async function fetchRegion(url: string, options?: RequestInit): Promise<unknown> {
  const region = getRegion();
  const headers = new Headers(options?.headers ?? undefined);
  headers.set("x-region", region);
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    throw REGION_FETCH_FAILED;
  }

  return res.json() as Promise<unknown>;
}
