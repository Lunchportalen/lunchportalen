/**
 * Kanonisk kanalmodell for attribusjon og budsjettanbefaling (ingen auto-kjøp).
 * Plattformnavn normaliseres små bokstaver mot `social_posts.platform`.
 */
export const CHANNELS = [
  { id: "linkedin", type: "paid" as const },
  { id: "facebook", type: "paid" as const },
  { id: "instagram", type: "organic" as const },
  { id: "tiktok", type: "organic" as const },
] as const;

export type ChannelId = (typeof CHANNELS)[number]["id"];

const KNOWN = new Set<string>(CHANNELS.map((c) => c.id));

export function normalizeChannelKey(platform: string | null | undefined): string {
  const p = String(platform ?? "").trim().toLowerCase();
  if (KNOWN.has(p)) return p;
  return "unknown";
}

/** Minimal shape for e-post / kanal-utkast (ingen eksterne kall). */
export type DistributablePost = { text: string };

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

/**
 * Deterministisk fordeling av synlige kanaler fra tekst + score (kalender + læring).
 * Ingen nettverk; samme input ⇒ samme output.
 */
export type ChannelDistribution = {
  ads: boolean;
  email: boolean;
  retargeting: boolean;
  linkedin: boolean;
  facebook: boolean;
  instagram: boolean;
  tiktok: boolean;
};

export function distribute(input: { text: string; performanceScore: number }): ChannelDistribution {
  const h = hashString(`${input.text}\0${input.performanceScore}`);
  const s = Math.max(0, Math.min(100, input.performanceScore)) / 100;

  const pick = (offset: number, threshold: number): boolean => (((h >> offset) & 0xff) / 255) < threshold;

  const ads = pick(0, 0.35 + s * 0.4) || s > 0.75;
  const email = pick(8, 0.25 + s * 0.35);
  const retargeting = pick(16, 0.2 + s * 0.25);

  const linkedin = ads && pick(1, 0.55);
  const facebook = ads && (!linkedin || pick(2, 0.45));
  const instagram = pick(4, 0.4 + s * 0.3);
  const tiktok = pick(12, 0.4 + s * 0.3);

  return { ads, email, retargeting, linkedin, facebook, instagram, tiktok };
}
