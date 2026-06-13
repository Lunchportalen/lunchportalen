import { describe, expect, test } from "vitest";

import { PLAN_ORDER_CHOICE_KEYS, PLAN_TIERS } from "@/lib/cms/menuDayContract";
import {
  choiceKeyToMsdiCategorySlug,
  msdiSlugResolvesInCatalog,
} from "@/lib/orders/msdiChoiceSlug";

describe("PLAN_ORDER_CHOICE_KEYS → MSDI category slug (fail-loud)", () => {
  test("every plan choice key resolves to a known product_categories slug", () => {
    const failures: string[] = [];
    for (const tier of PLAN_TIERS) {
      for (const choiceKey of PLAN_ORDER_CHOICE_KEYS[tier]) {
        const slug = choiceKeyToMsdiCategorySlug(choiceKey);
        if (!msdiSlugResolvesInCatalog(slug)) {
          failures.push(`${tier}:${choiceKey}→${slug}`);
        }
      }
    }
    expect(failures, `unmapped choice keys: ${failures.join(", ")}`).toEqual([]);
  });

  test("varmmat aliases to varmrett for MSDI only", () => {
    expect(choiceKeyToMsdiCategorySlug("varmmat")).toBe("varmrett");
    expect(msdiSlugResolvesInCatalog("varmrett")).toBe(true);
  });

  test("FAIL-LOUD: probe list with dummy must report unresolved (proves guard fires)", () => {
    const allReal = PLAN_TIERS.flatMap((t) => PLAN_ORDER_CHOICE_KEYS[t]);
    const dummy = "__test_no_msdi_slug__";
    expect(allReal).not.toContain(dummy);

    function unresolved(keys: string[]) {
      return keys.filter((k) => !msdiSlugResolvesInCatalog(choiceKeyToMsdiCategorySlug(k)));
    }

    expect(unresolved(allReal)).toEqual([]);
    expect(unresolved([...allReal, dummy])).toEqual([dummy]);
  });
});
