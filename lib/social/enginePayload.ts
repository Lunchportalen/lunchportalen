/**
 * Delte payload-typer for Social Engine (ingen server-only — trygge for klient-import av typer).
 */

import type { Location } from "@/lib/social/location";

export type SocialEngineMediaPayload = {
  imageUrl: string | null;
  alt?: string;
  source?: string;
  mediaItemId: string | null;
};

export type GeneratedSocialPostPayload = {
  text: string;
  hook: string;
  cta: string;
  hashtags: string[];
  media: SocialEngineMediaPayload;
  /**
   * Intern produkt-URL med ?src=ai_social&postId=… når calendarPostId er satt og gyldig;
   * ellers /product/{id} uten sporingsparametre (ingen falsk attributjon).
   */
  revenueTrackingPath?: string | null;
  /** Redirect-sporingslenke når calendarPostId er satt. */
  link?: string | null;
};

export type LearningEngagementTier = "low" | "mid" | "high";

export type SocialGenerateContext = {
  slotDay: string;
  location: Location;
  calendarPostId?: string;
  learningEngagementTier?: LearningEngagementTier;
};
