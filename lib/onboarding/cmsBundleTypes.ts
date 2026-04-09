/** Serializable CMS snapshot for firma-onboarding (safe for client + server). */
export type FirmaOnboardingCmsBundle = {
  basis: { price: number; allowedMeals: string[] };
  luxus: { price: number; allowedMeals: string[] };
  menuTitles: Record<string, string>;
};
