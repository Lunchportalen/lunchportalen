/**
 * SMART-0 — design doc + invariant tests only.
 * Locks SMART-MENU owner model before any runtime implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const SMART_MENU_DESIGN_DOC = "docs/architecture/smart-menu-language-profile-currency.md";

const SECRET_PATTERNS = [
  /password\s*=\s*[^\s\n]+/i,
  /access_token\s*=\s*[^\s\n]+/i,
  /refresh_token\s*=\s*[^\s\n]+/i,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
  /service_role\s*=\s*[^\s\n]+/i,
  /postgresql:\/\/[^\s\n]+:[^\s\n]+@/i,
  /\.env\.local/,
] as const;

function readDoc(): string {
  return fs.readFileSync(path.join(ROOT, SMART_MENU_DESIGN_DOC), "utf8");
}

describe("SMART-0 — smart-menu architecture design doc", () => {
  test("design doc exists", () => {
    expect(fs.existsSync(path.join(ROOT, SMART_MENU_DESIGN_DOC))).toBe(true);
  });

  test("design doc declares SMART-0 docs/tests only — no runtime", () => {
    const doc = readDoc();
    expect(doc).toMatch(/SMART-0/);
    expect(doc).toMatch(/design.*invariant tests only|design \+ invariant tests only/i);
    expect(doc).toMatch(/no runtime implementation/i);
    expect(doc).toMatch(/DB\s*\/\s*RLS migration/i);
  });

  test("design doc documents four-layer architecture", () => {
    const doc = readDoc();
    expect(doc).toMatch(/Employee UI Language Layer/);
    expect(doc).toMatch(/Provider-approved Translation Layer/);
    expect(doc).toMatch(/Provider Menu Profile Layer/);
    expect(doc).toMatch(/Commercial Locale \/ Currency Layer/);
  });

  test("design doc locks owner model", () => {
    const doc = readDoc();
    expect(doc).toMatch(/Employee UI language|Employee language/i);
    expect(doc).toMatch(/Menu profile|menu profile/i);
    expect(doc).toMatch(/Provider.*approv|approves translations/i);
    expect(doc).toMatch(/Currency.*contract|contract.*currency|never.*employee.*language/i);
  });

  test("employee language is display-only — cannot affect identity or commercial fields", () => {
    const doc = readDoc();
    expect(doc).toMatch(/choice_key/);
    expect(doc).toMatch(/item_key|itemKey/);
    expect(doc).toMatch(/planTier/);
    expect(doc).toMatch(/provider scope|provider_id/);
    expect(doc).toMatch(/menuDay/);
    expect(doc).toMatch(/warm dish/i);
    expect(doc).toMatch(/currency/);
    expect(doc).toMatch(/Must never control|must never control/i);
    expect(doc).not.toMatch(/employee language controls currency/i);
  });

  test("provider-approved translations — employee visibility rules", () => {
    const doc = readDoc();
    expect(doc).toMatch(/approved translation/i);
    expect(doc).toMatch(/draft/i);
    expect(doc).toMatch(/suggested/i);
    expect(doc).toMatch(/rejected/i);
    expect(doc).toMatch(/stale/i);
    expect(doc).toMatch(/fallback to original|Original provider text/i);
    expect(doc).toMatch(/Employee must never see|must never see/i);
  });

  test("translation data model — menu_content_translations columns", () => {
    const doc = readDoc();
    expect(doc).toMatch(/menu_content_translations/);
    expect(doc).toMatch(/provider_id/);
    expect(doc).toMatch(/source_kind/);
    expect(doc).toMatch(/source_ref/);
    expect(doc).toMatch(/\bfield\b/);
    expect(doc).toMatch(/\blocale\b/);
    expect(doc).toMatch(/original_text_hash/);
    expect(doc).toMatch(/translated_text/);
    expect(doc).toMatch(/\bstatus\b/);
    expect(doc).toMatch(/approved_by/);
    expect(doc).toMatch(/approved_at/);
  });

  test("stale policy — hash mismatch marks stale; employee sees original until reapproved", () => {
    const doc = readDoc();
    expect(doc).toMatch(/original_text_hash/);
    expect(doc).toMatch(/stale/i);
    expect(doc).toMatch(/hash.*mismatch|mismatch.*hash|reapproved|reapprove/i);
    expect(doc).toMatch(/original provider text|Original provider text/i);
  });

  test("menu profile source — provider_settings.menu_profile_id and rules", () => {
    const doc = readDoc();
    expect(doc).toMatch(/provider_settings\.menu_profile_id/);
    expect(doc).toMatch(/market default|Market default/i);
    expect(doc).toMatch(/fallback|norwegian_company_lunch/i);
    expect(doc).toMatch(/employee language cannot change profile|Employee language cannot change profile/i);
    expect(doc).toMatch(/future published menus only|future publish only/i);
  });

  test("currency source — agreement to NOK fallback; UI locale forbidden", () => {
    const doc = readDoc();
    expect(doc).toMatch(/agreement\.currency/);
    expect(doc).toMatch(/provider_settings\.default_currency/);
    expect(doc).toMatch(/marketConfig\.defaultCurrency/);
    expect(doc).toMatch(/NOK/);
    expect(doc).toMatch(/lp_locale/);
    expect(doc).toMatch(/profiles\.preferred_locale/);
    expect(doc).toMatch(/Must never use|must never use/i);
    expect(doc).toMatch(/never changes currency|never.*employee.*language/i);
  });

  test("order identity invariant — keys and scope; translated text never identity", () => {
    const doc = readDoc();
    expect(doc).toMatch(/choice_key/);
    expect(doc).toMatch(/item_key|itemKey/);
    expect(doc).toMatch(/server-side tier|tier.*price/i);
    expect(doc).toMatch(/Translated title|translated title/i);
    expect(doc).toMatch(/never use|Orders never use/i);
    expect(doc).toMatch(/lp_order_set/);
  });

  test("PR #389 superseded — do not merge as-is", () => {
    const doc = readDoc();
    expect(doc).toMatch(/PR #389/);
    expect(doc).toMatch(/do not merge|Do not merge/i);
    expect(doc).toMatch(/superseded|Superseded/i);
    expect(doc).toMatch(/SMART-MENU/);
  });

  test("design doc forbids premature runtime/cutover/flag claims", () => {
    const doc = readDoc();
    expect(doc).toMatch(/G5d\.8.*not started|Not started/i);
    expect(doc).toMatch(/no cutover|No cutover|cutover activation/i);
    expect(doc).toMatch(/source-of-truth|source of truth/i);
    expect(doc).toMatch(/auto-rollout|Auto-rollout/i);
    expect(doc).toMatch(/LP_MENU_PROFILE_\*.*OFF|flags OFF|remain OFF/i);
    expect(doc).toMatch(/Production flags|Production env/i);
    expect(doc).not.toMatch(/G5d\.8 started/i);
    expect(doc).not.toMatch(/runtime cutover approved/i);
    expect(doc).not.toMatch(/LP_MENU_PROFILE_.* activated in Production/i);
    expect(doc).not.toMatch(/full Tripletex automation enabled/i);
  });

  test("design doc documents SMART PR sequence SMART-0 through SMART-6", () => {
    const doc = readDoc();
    for (const phase of ["SMART-0", "SMART-1", "SMART-2", "SMART-3", "SMART-4", "SMART-5", "SMART-6"]) {
      expect(doc).toContain(phase);
    }
  });

  test("design doc documents SMART-1 migration without live employee translations", () => {
    const doc = readDoc();
    expect(doc).toMatch(/20260728120000_menu_content_translations\.sql/);
    expect(doc).toMatch(/Employee direct access: denied|No direct table access/i);
    expect(doc).not.toMatch(/employee translations are live/i);
  });

  test("design doc ends with next-phase gate — explicit owner GO", () => {
    const doc = readDoc();
    expect(doc).toMatch(/READY FOR SMART-1.*only after SMART-0 is merged/i);
    expect(doc).toMatch(/READY FOR SMART-3.*only after SMART-2 is merged/i);
    expect(doc).toMatch(/explicit GO/i);
  });

  test("design doc contains no obvious secrets", () => {
    const doc = readDoc();
    for (const pattern of SECRET_PATTERNS) {
      expect(doc, `design doc must not contain secret pattern ${pattern}`).not.toMatch(pattern);
    }
  });
});
