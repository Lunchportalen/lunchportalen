export type MarketDef = {
  id: string;
  name: string;
  currency: string;
  language: string;
  /** Om markedet er aktivt i katalogen (tilsvarer «active» i produktspes.). */
  enabled: boolean;
};

/**
 * Markedskatalog — utvid med nye land uten å endre eksisterende ID-er.
 * `enabled` er standard (kode); runtime kan overstyres via API (superadmin).
 */
export const MARKETS: MarketDef[] = [
  {
    id: "no",
    name: "Norway",
    currency: "NOK",
    language: "no",
    enabled: true,
  },
  {
    id: "se",
    name: "Sweden",
    currency: "SEK",
    language: "sv",
    enabled: false,
  },
  {
    id: "dk",
    name: "Denmark",
    currency: "DKK",
    language: "da",
    enabled: false,
  },
];
