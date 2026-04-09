import "server-only";

import { getProductPlan } from "@/lib/cms/getProductPlan";
import {
  mergeMealContractIntoAgreementJson,
  parseMealContractFromAgreementJson,
  resolveAgreementMealTypeForDay,
  validateMealContractPayload,
  type StoredMealContract,
} from "@/lib/server/agreements/mealContract";

export type { StoredMealContract };

export async function validateMealContractForAgreementWrite(opts: {
  rpcTier: "BASIS" | "LUXUS";
  deliveryDays: string[];
  mealContract: unknown | undefined;
}): Promise<
  | { ok: true; skip: true }
  | { ok: true; skip: false; normalized: StoredMealContract }
  | { ok: false; code: string; message: string }
> {
  if (opts.mealContract === undefined || opts.mealContract === null) return { ok: true, skip: true };
  const [cmsBasis, cmsLuxus] = await Promise.all([getProductPlan("basis"), getProductPlan("luxus")]);
  const res = validateMealContractPayload({
    rpcTier: opts.rpcTier,
    deliveryDays: opts.deliveryDays,
    payload: opts.mealContract,
    cmsBasis,
    cmsLuxus,
  });
  if (res.ok === false) return res;
  return { ok: true, skip: false, normalized: res.normalized };
}

export { mergeMealContractIntoAgreementJson, parseMealContractFromAgreementJson, resolveAgreementMealTypeForDay };
