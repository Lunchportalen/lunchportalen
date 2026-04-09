/**
 * Kampanjestruktur fra AI-video — rent data, ingen nettverk.
 */

export type VideoForAdCampaign = {
  videoUrl: string | null;
  previewUrl: string | null;
  script: { hook: string; cta?: string };
  conversionVideoId?: string;
};

export type ProductForAdCampaign = {
  id: string;
  name: string;
};

export type BuiltAdCampaign = {
  name: string;
  creative: string | null;
  text: string;
  cta: "SHOP_NOW";
  budget: number;
  productId: string;
  productName: string;
  conversionVideoId: string | null;
  postId: string | null;
};

export function buildCampaign(video: VideoForAdCampaign, product: ProductForAdCampaign): BuiltAdCampaign {
  const creative = video.videoUrl ?? video.previewUrl ?? null;
  const baseName = product.name.trim() || "produkt";
  return {
    name: `AI Campaign ${baseName}`.slice(0, 200),
    creative,
    text: video.script.hook,
    cta: "SHOP_NOW",
    budget: 0,
    productId: product.id,
    productName: baseName,
    conversionVideoId: video.conversionVideoId ?? null,
    postId: null,
  };
}
