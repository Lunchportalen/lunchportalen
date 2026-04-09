/** Comma-separated `LP_CAPITAL_MARKETS` (default NO,SE,DK). */
export function listConfiguredMarkets(): string[] {
  const raw = String(process.env.LP_CAPITAL_MARKETS ?? "NO,SE,DK")
    .trim()
    .toUpperCase();
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ["NO", "SE", "DK"];
}

export function defaultMarketId(): string {
  return String(process.env.LP_CAPITAL_DEFAULT_MARKET ?? "NO")
    .trim()
    .toUpperCase() || "NO";
}

const LOCALE_TO_MARKET: Record<string, string> = {
  nb: "NO",
  nn: "NO",
  no: "NO",
  sv: "SE",
  se: "SE",
  da: "DK",
  dk: "DK",
};

/**
 * Resolves market from `social_posts` row (content json or optional column).
 * Unknown → default market (deterministic).
 */
export function resolveMarketFromPost(post: Record<string, unknown>, allowed: Set<string>): string {
  const direct = post.market ?? post.region;
  if (typeof direct === "string" && direct.trim()) {
    const u = direct.trim().toUpperCase();
    if (allowed.has(u)) return u;
  }

  const raw = post.content;
  let content: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) content = p as Record<string, unknown>;
    } catch {
      content = null;
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    content = raw as Record<string, unknown>;
  }

  if (content) {
    const m = content.market ?? content.region;
    if (typeof m === "string" && m.trim()) {
      const u = m.trim().toUpperCase();
      if (allowed.has(u)) return u;
    }
    const loc = String(content.locale ?? "").toLowerCase();
    if (loc && LOCALE_TO_MARKET[loc]) {
      const mm = LOCALE_TO_MARKET[loc]!;
      if (allowed.has(mm)) return mm;
    }
  }

  const dm = defaultMarketId();
  return allowed.has(dm) ? dm : [...allowed][0] ?? "NO";
}
