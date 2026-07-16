/**
 * FASE 11 — native-/legal-review-metadata per grunnspråk (edge-safe).
 *
 * Sannhetskilde: messages/review-status.json (audit via git-historikk).
 * Kobling til markedsaktivering: et marked bør ikke settes kommersielt
 * ACTIVE (Fase 10-registeret) før språket har nativeReview=approved —
 * synliggjort i superadmin-markedsflaten, håndhevet redaksjonelt.
 */
import reviewStatus from "@/messages/review-status.json";

export type LanguageReviewState = "pending" | "in_review" | "approved";

export type LanguageReviewEntry = {
  nativeReview: LanguageReviewState;
  legalReview: LanguageReviewState;
  reviewedBy: string | null;
  reviewedAt: string | null;
  note: string;
};

const LANGUAGES = (reviewStatus as { languages: Record<string, LanguageReviewEntry> }).languages;

export function languageReviewStatus(language: string): LanguageReviewEntry | null {
  return LANGUAGES[String(language ?? "").trim().toLowerCase()] ?? null;
}

export function allLanguageReviewStatuses(): Record<string, LanguageReviewEntry> {
  return LANGUAGES;
}
