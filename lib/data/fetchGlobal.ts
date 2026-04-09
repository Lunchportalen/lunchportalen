import "server-only";

const DEFAULT_REGIONS = ["eu", "us", "asia"] as const;

function regionList(): string[] {
  const raw = String(process.env.DATA_GLOBAL_REGIONS ?? "").trim();
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
 * Prøver fetch med x-region i fast rekkefølge (deterministisk).
 */
export async function fetchGlobal(url: string, options?: RequestInit): Promise<unknown | null> {
  const regions = regionList();

  for (const r of regions) {
    try {
      const headers = new Headers(options?.headers ?? undefined);
      headers.set("x-region", r);
      const res = await fetch(url, { ...options, headers });

      if (!res.ok) {
        console.error("[FETCH_GLOBAL]", { url, region: r, status: res.status });
        continue;
      }

      try {
        return await res.json();
      } catch (e) {
        console.error("[FETCH_GLOBAL_JSON]", { url, region: r, err: e });
      }
    } catch (e) {
      console.error("[FETCH_GLOBAL]", { url, region: r, err: e });
    }
  }

  return null;
}
