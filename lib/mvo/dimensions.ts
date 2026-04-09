/**
 * MVO-dimensjoner (bundet sett — unngår kombinatorisk eksplosjon i matrise).
 * Utvidelser (f.eks. retargeting) legges til her uten å endre eksisterende nøkkel-semantikk.
 */
export const CHANNELS = ["linkedin", "facebook", "email"] as const;

export const SEGMENTS = ["small_company", "mid_company", "enterprise"] as const;

export const TIMINGS = ["morning", "afternoon", "evening"] as const;

export type ChannelId = (typeof CHANNELS)[number];
export type SegmentId = (typeof SEGMENTS)[number];
export type TimingId = (typeof TIMINGS)[number];
