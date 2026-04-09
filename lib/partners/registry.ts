import "server-only";

import type { Partner } from "@/lib/partners/model";
import { createPartner } from "@/lib/partners/model";
import { opsLog } from "@/lib/ops/log";

const partners: Partner[] = [];

/** Additiv registrering (f.eks. runtime / fremtidig admin). Reversibel: ikke eksponer sletting uten audit. */
export function registerPartner(input: { name: string; type: Partner["type"] }): Partner {
  const p = createPartner(input);
  partners.push(p);
  opsLog("partner_registered", { partnerId: p.id, type: p.type });
  return p;
}

export function listPartners(): Partner[] {
  return [...partners];
}
