/**
 * Premium typography system — focused proof.
 * Registry resolution, semantic token mapping, CMS validation, fail-safe behavior.
 * No snapshots; helper and contract tests only.
 */
import { describe, test, expect } from "vitest";
import {
  FONT_ROLES,
  APPROVED_FONT_OPTIONS,
  DEFAULT_THEME_FONT_BY_ROLE,
  fontRegistry,
  getFontFamily,
  getFontCssVar,
  typographyTokenClasses,
  isThemeFontOption,
  resolveThemeFontOption,
  resolveThemeFontByRole,
  getTypographyTokenForThemeRole,
  type FontRole,
  type ThemeFontOption,
} from "@/lib/design/fontRegistry";

const APPROVED_VALUES: ThemeFontOption[] = ["body", "heading", "display"];
const VALID_TOKEN_CLASSES = ["font-body", "font-heading", "font-display"];

describe("fontRegistry — premium font resolution", () => {
  test("every FontRole has a registry entry with cssVar and fallbackStack", () => {
    for (const role of FONT_ROLES) {
      const entry = fontRegistry[role];
      expect(entry).toBeDefined();
      expect(typeof entry.cssVar).toBe("string");
      expect(entry.cssVar.startsWith("--lp-font-")).toBe(true);
      expect(typeof entry.fallbackStack).toBe("string");
      expect(entry.fallbackStack.length).toBeGreaterThan(0);
    }
  });

  test("getFontFamily(role) returns var() plus fallback stack (no raw font name)", () => {
    for (const role of FONT_ROLES) {
      const family = getFontFamily(role);
      expect(typeof family).toBe("string");
      expect(family).toContain("var(--lp-font-");
      expect(family).toContain("system-ui");
      expect(family).not.toMatch(/["'](?:Inter|Manrope|Fraunces)["']/);
    }
  });

  test("getFontCssVar(role) returns one of three CSS variable names", () => {
    const vars = new Set(["--lp-font-body", "--lp-font-heading", "--lp-font-display"]);
    for (const role of FONT_ROLES) {
      const v = getFontCssVar(role);
      expect(vars.has(v)).toBe(true);
    }
  });
});

describe("typographyTokenClasses — semantic token mapping", () => {
  test("every FontRole maps to a token class", () => {
    for (const role of FONT_ROLES) {
      const token = typographyTokenClasses[role];
      expect(typeof token).toBe("string");
      expect(token.startsWith("font-")).toBe(true);
    }
  });

  test("token classes are only approved premium tokens (no arbitrary classes)", () => {
    const allowed = new Set([
      "font-body",
      "font-heading",
      "font-display",
      "font-editorial",
      "font-campaign",
      "font-accent",
      "font-ui",
    ]);
    for (const role of FONT_ROLES) {
      expect(allowed.has(typographyTokenClasses[role])).toBe(true);
    }
  });

  test("editorial and campaign map to display token; accent maps to heading; ui maps to body", () => {
    expect(typographyTokenClasses.editorial).toBe("font-editorial");
    expect(typographyTokenClasses.campaign).toBe("font-campaign");
    expect(typographyTokenClasses.accent).toBe("font-accent");
    expect(typographyTokenClasses.ui).toBe("font-ui");
  });
});

describe("CMS font role selection — approved options only", () => {
  test("APPROVED_FONT_OPTIONS has exactly three entries", () => {
    expect(APPROVED_FONT_OPTIONS.length).toBe(3);
  });

  test("approved options are only body, heading, display", () => {
    const values = APPROVED_FONT_OPTIONS.map((o) => o.value);
    expect(values.sort()).toEqual([...APPROVED_VALUES].sort());
  });

  test("DEFAULT_THEME_FONT_BY_ROLE has every FontRole with an approved value", () => {
    for (const role of FONT_ROLES) {
      const val = DEFAULT_THEME_FONT_BY_ROLE[role];
      expect(APPROVED_VALUES.includes(val)).toBe(true);
    }
  });
});

describe("isThemeFontOption — validation", () => {
  test("accepts only body, heading, display", () => {
    expect(isThemeFontOption("body")).toBe(true);
    expect(isThemeFontOption("heading")).toBe(true);
    expect(isThemeFontOption("display")).toBe(true);
  });

  test("rejects invalid or unexpected values", () => {
    expect(isThemeFontOption("")).toBe(false);
    expect(isThemeFontOption("foo")).toBe(false);
    expect(isThemeFontOption("editorial")).toBe(false);
    expect(isThemeFontOption(null)).toBe(false);
    expect(isThemeFontOption(undefined)).toBe(false);
    expect(isThemeFontOption(1)).toBe(false);
    expect(isThemeFontOption({})).toBe(false);
  });
});

describe("resolveThemeFontOption — fail-safe single role", () => {
  test("returns value when valid", () => {
    expect(resolveThemeFontOption("body", "body")).toBe("body");
    expect(resolveThemeFontOption("heading", "display")).toBe("display");
  });

  test("returns default for role when value invalid or missing", () => {
    expect(resolveThemeFontOption("body", "foo")).toBe("body");
    expect(resolveThemeFontOption("heading", null)).toBe("heading");
    expect(resolveThemeFontOption("display", undefined)).toBe("display");
    expect(resolveThemeFontOption("editorial", "")).toBe(DEFAULT_THEME_FONT_BY_ROLE.editorial);
    expect(resolveThemeFontOption("ui", 1)).toBe("body");
  });
});

describe("resolveThemeFontByRole — fail-safe full map", () => {
  test("returns full record for valid input", () => {
    const raw = { ...DEFAULT_THEME_FONT_BY_ROLE };
    const out = resolveThemeFontByRole(raw);
    expect(Object.keys(out).sort()).toEqual([...FONT_ROLES].sort());
    for (const role of FONT_ROLES) {
      expect(APPROVED_VALUES.includes(out[role])).toBe(true);
    }
  });

  test("null/undefined/non-object yields all defaults", () => {
    const out = resolveThemeFontByRole(null);
    expect(Object.keys(out).sort()).toEqual([...FONT_ROLES].sort());
    for (const role of FONT_ROLES) {
      expect(out[role]).toBe(DEFAULT_THEME_FONT_BY_ROLE[role]);
    }
    expect(resolveThemeFontByRole(undefined)).toEqual(resolveThemeFontByRole(null));
    expect(resolveThemeFontByRole(42)).toEqual(resolveThemeFontByRole(null));
  });

  test("partial or invalid entries fall back to default for that role", () => {
    const out = resolveThemeFontByRole({ body: "foo", heading: "heading" });
    expect(out.body).toBe("body");
    expect(out.heading).toBe("heading");
    expect(out.display).toBe("display");
  });
});

describe("getTypographyTokenForThemeRole — safe token for render", () => {
  test("without theme returns one of three token classes", () => {
    for (const role of FONT_ROLES) {
      const token = getTypographyTokenForThemeRole(role);
      expect(VALID_TOKEN_CLASSES.includes(token)).toBe(true);
    }
  });

  test("with valid theme returns correct token", () => {
    expect(getTypographyTokenForThemeRole("body", { ...DEFAULT_THEME_FONT_BY_ROLE })).toBe(
      "font-body"
    );
    expect(
      getTypographyTokenForThemeRole("heading", {
        ...DEFAULT_THEME_FONT_BY_ROLE,
        heading: "display",
      })
    ).toBe("font-display");
  });

  test("with invalid theme entry falls back to default token", () => {
    const broken: Record<FontRole, ThemeFontOption> = {
      ...DEFAULT_THEME_FONT_BY_ROLE,
      body: "wrong" as unknown as ThemeFontOption,
    };
    const token = getTypographyTokenForThemeRole("body", broken);
    expect(VALID_TOKEN_CLASSES.includes(token)).toBe(true);
  });

  test("never returns empty or ambiguous class", () => {
    for (const role of FONT_ROLES) {
      expect(getTypographyTokenForThemeRole(role, null)).not.toBe("");
      expect(getTypographyTokenForThemeRole(role, {} as Record<FontRole, ThemeFontOption>)).not.toBe(
        ""
      );
    }
  });
});
