/**
 * Annonseplattform-adapter — Meta / TikTok kan registreres; tom liste = trygg fallback (ingen crash).
 */

export type AdsCreateCampaignInput = {
  name: string;
  creative: string | null;
  text: string;
  cta: string;
  budget: number;
  productId: string;
  productName?: string;
  conversionVideoId?: string | null;
  postId?: string | null;
};

export type AdsProvider = {
  name: string;
  createCampaign: (input: AdsCreateCampaignInput) => Promise<Record<string, unknown>>;
};

export const providers: AdsProvider[] = [];

export function getAdsProvider(): AdsProvider | null {
  return providers[0] ?? null;
}

/** Registrer leverandør (f.eks. ved init). Første registrerte brukes av {@link getAdsProvider}. */
export function registerAdsProvider(provider: AdsProvider): void {
  providers.push(provider);
}
