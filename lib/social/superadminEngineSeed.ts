/**
 * Deterministiske demo-produkter for superadmin Social Engine (ingen bruker-input som sannhet).
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";

export const SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS: SocialProductRef[] = [
  {
    id: "lp-b2b-core",
    name: "Lunchportalen — bedriftslunsj med kontroll",
    url: "https://lunchportalen.no",
    price: 12_900,
    cost: 4_200,
    stock: 42,
  },
  {
    id: "lp-b2b-roi",
    name: "Mindre administrasjon, forutsigbar drift",
    url: "https://lunchportalen.no",
    price: 9_800,
    cost: 5_100,
    stock: 6,
  },
];
