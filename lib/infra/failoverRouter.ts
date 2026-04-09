import "server-only";

import { regionListForRouting } from "@/lib/infra/regions";

/**
 * Multi-region forsøk med x-region header (deterministisk rekkefølge).
 * Logger alle feil; kaster strukturert objekt ved total fiasko.
 */
export async function fetchWithFailover(url: string, options?: RequestInit): Promise<unknown> {
  const regions = regionListForRouting();

  for (const region of regions) {
    try {
      const headers = new Headers(options?.headers ?? undefined);
      headers.set("x-region", region);
      const res = await fetch(url, { ...options, headers });

      if (!res.ok) {
        console.error("[MULTI_REGION_FAIL]", { url, region, status: res.status });
        continue;
      }

      try {
        return await res.json();
      } catch (e) {
        console.error("[MULTI_REGION_JSON]", { url, region, err: e });
      }
    } catch (e) {
      console.error("[MULTI_REGION]", { url, region, err: e });
    }
  }

  throw {
    code: "MULTI_REGION_FAIL",
    message: "All regions failed",
    source: "infra",
    severity: "high" as const,
  };
}
