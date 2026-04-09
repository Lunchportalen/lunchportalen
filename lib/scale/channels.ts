/**
 * Scale channel engine — **read-only** ranking from sporet data.
 * Publisering skjer kun via eksisterende sosialmotor (`publishLivePost`); ingen duplikat av den logikken her.
 *
 * Attribusjon følger samme kjedeprinsipp som vekstaggregat: `social_posts` → ordre via `social_post_id` / `attribution.postId`.
 * Plattformnøkler normaliseres med {@link normalizeChannelKey} fra vekstlaget.
 */
import "server-only";

import { normalizeChannelKey } from "@/lib/growth/channels";
import { collectRevenueData } from "@/lib/revenue/collect";

export type Channel = {
  id: "facebook" | "instagram" | "tiktok" | "email";
  active: boolean;
  performance: {
    clicks: number;
    conversions: number;
    revenue: number;
  };
};

export const SCALE_CHANNEL_IDS = ["facebook", "instagram", "tiktok", "email"] as const;

export type ScaleChannelId = (typeof SCALE_CHANNEL_IDS)[number];

/** Eksisterende publiseringsinngang — ikke dupliser; bruk denne fra jobber/API. */
export const SOCIAL_PUBLISH_MODULE = "@/lib/social/liveChannelPublish";
export const SOCIAL_PUBLISH_FN = "publishLivePost";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Samme felt som i `aggregateMarketChannelMetrics` (lib/growth/capitalAllocation/aggregate.ts). */
function orderPostId(o: Record<string, unknown>): string | null {
  const sid = o.social_post_id;
  if (typeof sid === "string" && sid.trim()) return sid.trim();
  const attr = o.attribution;
  if (attr && typeof attr === "object" && !Array.isArray(attr)) {
    const pid = (attr as Record<string, unknown>).postId;
    if (typeof pid === "string" && pid.trim()) return pid.trim();
  }
  return null;
}

function clicksFromContent(content: unknown): number {
  if (!content || typeof content !== "object" || Array.isArray(content)) return 0;
  const m = (content as Record<string, unknown>).metrics;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const c = (m as Record<string, unknown>).clicks;
    if (typeof c === "number" && Number.isFinite(c) && c >= 0) return c;
  }
  return 0;
}

/**
 * Mapper `social_posts.platform` til scale-kanal. `linkedin` / `unknown` → **null** (ingen blind bucket).
 * `email` er ikke i {@link normalizeChannelKey}-listen — håndteres eksplisitt først.
 */
export function mapPostPlatformToScaleChannel(platform: string | null | undefined): ScaleChannelId | null {
  const raw = String(platform ?? "").trim().toLowerCase();
  if (raw === "email") return "email";
  const p = normalizeChannelKey(platform);
  if (p === "facebook") return "facebook";
  if (p === "instagram") return "instagram";
  if (p === "tiktok") return "tiktok";
  return null;
}

type Acc = { clicks: number; conversions: number; revenue: number };

function emptyAcc(): Acc {
  return { clicks: 0, conversions: 0, revenue: 0 };
}

/**
 * Henter sporet ytelse fra DB via {@link collectRevenueData} (én sannhetskilde for poster/ordre).
 */
export async function loadTrackedChannels(): Promise<{
  ok: true;
  channels: Channel[];
  explain: string[];
} | { ok: false; error: string }> {
  try {
    const data = await collectRevenueData();
    const posts = Array.isArray(data.posts) ? data.posts : [];
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const leads = Array.isArray(data.leads) ? data.leads : [];

    const byId = new Map<string, Record<string, unknown>>();
    for (const post of posts) {
      if (!post || typeof post !== "object") continue;
      const id = typeof (post as Record<string, unknown>).id === "string" ? String((post as Record<string, unknown>).id).trim() : "";
      if (id) byId.set(id, post as Record<string, unknown>);
    }

    const acc: Record<ScaleChannelId, Acc> = {
      facebook: emptyAcc(),
      instagram: emptyAcc(),
      tiktok: emptyAcc(),
      email: emptyAcc(),
    };

    for (const post of posts) {
      if (!post || typeof post !== "object") continue;
      const p = post as Record<string, unknown>;
      const ch = mapPostPlatformToScaleChannel(p.platform as string | undefined);
      if (!ch) continue;
      acc[ch].clicks += clicksFromContent(p.content);
    }

    const seenOrder = new Set<string>();
    for (const raw of orders) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const oid = typeof o.id === "string" ? o.id.trim() : "";
      if (oid) {
        if (seenOrder.has(oid)) continue;
        seenOrder.add(oid);
      }
      const pid = orderPostId(o);
      if (!pid) continue;
      const post = byId.get(pid);
      if (!post) continue;
      const ch = mapPostPlatformToScaleChannel(post.platform as string | undefined);
      if (!ch) continue;
      acc[ch].conversions += 1;
      acc[ch].revenue += num(o.line_total);
    }

    /** E-postleads: tell som konverteringer på e-postkanalen når kilden er sporet (orphan → kun med forklaring). */
    let orphanEmailLeads = 0;
    for (const raw of leads) {
      if (!raw || typeof raw !== "object") continue;
      const l = raw as Record<string, unknown>;
      const sid = typeof l.source_post_id === "string" ? l.source_post_id.trim() : "";
      if (sid) {
        const post = byId.get(sid);
        if (post && mapPostPlatformToScaleChannel(post.platform as string | undefined) === "email") {
          acc.email.conversions += 1;
        }
      } else {
        orphanEmailLeads += 1;
      }
    }
    if (orphanEmailLeads > 0) {
      acc.email.conversions += orphanEmailLeads;
    }

    const channels: Channel[] = SCALE_CHANNEL_IDS.map((id) => ({
      id,
      active: true,
      performance: {
        clicks: acc[id].clicks,
        conversions: acc[id].conversions,
        revenue: acc[id].revenue,
      },
    }));

    const explain: string[] = [
      `Data: collectRevenueData() → social_posts + orders + lead_pipeline (samme kjede som vekstaggregat).`,
      `Klikk fra content.metrics.clicks per innlegg; konverteringer/omsetning fra ordre koblet til innlegg via post-id.`,
      `Plattform → kanal med normalizeChannelKey + eksplisitt mapping (linkedin/unknown ekskludert — ingen blind posting).`,
      orphanEmailLeads > 0
        ? `${orphanEmailLeads} lead(s) uten source_post_id er telt på e-postkanalen (orphan — vurder bedre sporing).`
        : `Ingen orphan-leads uten source_post_id.`,
      `Publisering: bruk ${SOCIAL_PUBLISH_MODULE} (${SOCIAL_PUBLISH_FN}) — ikke dupliser her.`,
    ];

    return { ok: true, channels, explain };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function channelScore(c: Channel): number {
  const { clicks, conversions, revenue } = c.performance;
  return Math.log1p(Math.max(0, revenue)) + 5 * Math.max(0, conversions) + 0.02 * Math.max(0, clicks);
}

export type PickBestChannelResult = {
  best: ScaleChannelId | null;
  scores: Record<ScaleChannelId, number>;
  explain: string[];
};

/**
 * Velger beste kanal ut fra **allerede målt** ytelse (ingen nettverkskall).
 * Ved lik score brukes stabil rekkefølge: facebook → instagram → tiktok → email.
 */
export function pickBestChannel(channels: ReadonlyArray<Channel>): PickBestChannelResult {
  const scores = {
    facebook: 0,
    instagram: 0,
    tiktok: 0,
    email: 0,
  } as Record<ScaleChannelId, number>;

  for (const c of channels) {
    if (!SCALE_CHANNEL_IDS.includes(c.id)) continue;
    scores[c.id] = channelScore(c);
  }

  const order: ScaleChannelId[] = ["facebook", "instagram", "tiktok", "email"];
  let best: ScaleChannelId | null = null;
  let bestS = -Infinity;
  for (const id of order) {
    const s = scores[id];
    if (s > bestS + 1e-12) {
      bestS = s;
      best = id;
    }
  }

  if (best != null && bestS <= 0) {
    best = null;
  }

  const explain: string[] = [
    `Score = log1p(revenue) + 5×conversions + 0.02×clicks (deterministisk, forklarbar).`,
    best == null
      ? "Alle scorer ≤ 0 — ingen «beste» kanal (ingen sporet effekt)."
      : `Høyeste score: ${best} (${bestS.toFixed(4)}). Ved lik score vinner tidligst i rekkefølgen facebook, instagram, tiktok, email.`,
  ];

  return { best, scores, explain };
}
