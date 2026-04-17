import { describe, expect, test } from "vitest";
import {
  getEffectiveAllowedBlockTypeKeys,
  isBlockTypeAllowedForDocumentType,
  validateBodyPayloadBlockAllowlist,
} from "@/lib/cms/blockAllowlistGovernance";

describe("blockAllowlistGovernance", () => {
  test("legacy body without documentType passes validation", () => {
    const body = { version: 1, blocks: [{ id: "1", type: "hero", title: "" }] };
    expect(validateBodyPayloadBlockAllowlist(body)).toEqual({ ok: true });
  });

  test("envelope with page + allowed block passes", () => {
    const body = {
      documentType: "page",
      fields: {},
      blocksBody: { version: 1, blocks: [{ id: "1", type: "hero", title: "" }] },
    };
    expect(validateBodyPayloadBlockAllowlist(body)).toEqual({ ok: true });
  });

  test("unknown documentType in envelope fails", () => {
    const body = {
      documentType: "not_a_real_type",
      fields: {},
      blocksBody: { version: 1, blocks: [] },
    };
    const r = validateBodyPayloadBlockAllowlist(body);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toBe("INVALID_DOCUMENT_TYPE");
  });

  test("forbidden block type fails when documentType is page", () => {
    const body = {
      documentType: "page",
      fields: {},
      blocksBody: {
        version: 1,
        blocks: [{ id: "1", type: "totally_fake_block_xyz", title: "" }],
      },
    };
    const r = validateBodyPayloadBlockAllowlist(body);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toBe("BLOCK_TYPES_NOT_ALLOWED");
  });

  test("getEffectiveAllowedBlockTypeKeys null alias means all (null)", () => {
    expect(getEffectiveAllowedBlockTypeKeys(null)).toBeNull();
    expect(getEffectiveAllowedBlockTypeKeys("")).toBeNull();
  });

  test("isBlockTypeAllowedForDocumentType respects page allowlist", () => {
    expect(isBlockTypeAllowedForDocumentType("page", "hero")).toBe(true);
    expect(isBlockTypeAllowedForDocumentType("page", "not_a_block")).toBe(false);
  });
});
