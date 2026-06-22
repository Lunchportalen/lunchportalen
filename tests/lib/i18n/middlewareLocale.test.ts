import { describe, expect, it } from "vitest";

import { LP_LOCALE_COOKIE, resolveLocaleFromCookie } from "@/lib/i18n/middlewareLocale";

describe("middlewareLocale cookie parsing", () => {
  it("fail-closes invalid cookie values to nb", () => {
    expect(resolveLocaleFromCookie(undefined)).toBe("nb");
    expect(resolveLocaleFromCookie("")).toBe("nb");
    expect(resolveLocaleFromCookie("xx")).toBe("nb");
    expect(resolveLocaleFromCookie("EN")).toBe("en");
    expect(resolveLocaleFromCookie("sv")).toBe("sv");
    expect(resolveLocaleFromCookie("de")).toBe("de");
  });

  it("uses locked cookie name constant", () => {
    expect(LP_LOCALE_COOKIE).toBe("lp_locale");
  });
});
