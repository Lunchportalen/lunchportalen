/**
 * SoMe-plan — rene forslag uten sideeffekter.
 */

export type SocialProductRef = {
  id: string;
  name: string;
  url: string;
  /** Valgfritt — kreves for margin-/lagerstyring i vekstmotor */
  price?: number;
  cost?: number;
  stock?: number;
};

export type SocialPlanItem = {
  type: "post";
  productId: string;
  productName: string;
  productUrl: string;
  reason: string;
};

export type SocialPlanInput = {
  products: SocialProductRef[];
  /** Valgfritt: side-/kampanjekontekst for senere utvidelse */
  pages?: unknown;
};

/**
 * Velger inntil tre produkter som kandidater for trygge produktinnlegg.
 */
export function generateSocialPlan(input: SocialPlanInput): SocialPlanItem[] {
  const products = Array.isArray(input.products) ? input.products : [];
  return products.slice(0, 3).map((p) => ({
    type: "post",
    productId: String(p.id ?? "").trim() || "unknown",
    productName: String(p.name ?? "").trim() || "Produkt",
    productUrl: String(p.url ?? "").trim() || "#",
    reason: "Egnet for produktpost — lav risiko når innholdet er faktabasert og godkjent.",
  }));
}
