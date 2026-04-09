import "server-only";

/**
 * Server-side fetch med aggressiv cache — krever absolutt URL (ingen relativ sti).
 */
export async function edgeFetch(url: string): Promise<unknown> {
  const u = String(url ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw {
      code: "EDGE_FETCH_INVALID_URL",
      message: "edgeFetch requires absolute URL",
      source: "edge",
      severity: "low",
    };
  }

  const res = await fetch(parsed.toString(), {
    cache: "force-cache",
  });

  if (!res.ok) {
    console.error("[EDGE_FETCH_HTTP]", { url: parsed.toString(), status: res.status });
    throw {
      code: "EDGE_FETCH_FAILED",
      message: `HTTP ${res.status}`,
      source: "edge",
      severity: "medium",
    };
  }

  return res.json() as Promise<unknown>;
}
