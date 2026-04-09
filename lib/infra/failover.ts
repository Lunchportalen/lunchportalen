import "server-only";

const DEFAULT_REGIONS = ["eu-west", "eu-central"] as const;

function regionsList(): string[] {
  const raw = String(process.env.FAILOVER_REGIONS ?? "").trim();
  if (raw.length > 0) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts;
  }
  return [...DEFAULT_REGIONS];
}

/**
 * Prøver samme URL med x-region satt i fast rekkefølge (deterministisk).
 * Logger feil per region; kaster strukturert objekt ved total fiasko.
 */
export async function fetchWithFailover(url: string, options?: RequestInit): Promise<unknown> {
  const regions = regionsList();

  for (const region of regions) {
    try {
      const headers = new Headers(options?.headers ?? undefined);
      headers.set("x-region", region);
      const res = await fetch(url, { ...options, headers });

      if (!res.ok) {
        console.error("[FAILOVER]", { url, region, status: res.status });
        continue;
      }

      try {
        return await res.json();
      } catch (e) {
        console.error("[FAILOVER_JSON]", { url, region, err: e });
      }
    } catch (e) {
      console.error("[FAILOVER]", { url, region, err: e });
    }
  }

  throw {
    code: "FAILOVER_FAILED",
    message: "All regions failed",
    source: "infra",
    severity: "high",
  };
}
