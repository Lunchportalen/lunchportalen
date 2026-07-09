import { describe, expect, it } from "vitest";

import {
  PROVIDER_MIRROR_OPERATOR_ACTION,
  validateProviderMirrorForGeneratorApply,
  mapProviderMirrorBlockerToApplyError,
} from "@/lib/menu-generator/providerMirrorPreflight";

const PROVIDER_ID = "a08e4742-c89d-48c5-a6a8-cf8532179083";
const SLUG = "swedish-lunch-pilot";

describe("validateProviderMirrorForGeneratorApply", () => {
  it("flags missing mirror as applyBlocked with PROVIDER_MIRROR_MISSING", () => {
    const result = validateProviderMirrorForGeneratorApply({
      providerId: PROVIDER_ID,
      expectedSlug: SLUG,
      mirror: null,
      mode: "dry_run",
    });

    expect(result.ok).toBe(false);
    expect(result.applyBlocked).toBe(true);
    expect(result.safeToApply).toBe(false);
    expect(result.blockerCode).toBe("PROVIDER_MIRROR_MISSING");
    expect(result.errorCode).toBe("provider_mirror_missing");
    expect(result.operatorAction).toBe(PROVIDER_MIRROR_OPERATOR_ACTION);
    expect(mapProviderMirrorBlockerToApplyError("PROVIDER_MIRROR_MISSING")).toBe("provider_mirror_missing");
  });

  it("flags mirror id mismatch", () => {
    const result = validateProviderMirrorForGeneratorApply({
      providerId: PROVIDER_ID,
      expectedSlug: SLUG,
      mirror: {
        sanityId: "other-id",
        name: "Swedish Lunch Pilot",
        slug: SLUG,
      },
      mode: "apply",
    });

    expect(result.blockerCode).toBe("PROVIDER_MIRROR_ID_MISMATCH");
    expect(result.applyBlocked).toBe(true);
    expect(result.errorCode).toBe("provider_mirror_id_mismatch");
  });

  it("flags mirror slug mismatch", () => {
    const result = validateProviderMirrorForGeneratorApply({
      providerId: PROVIDER_ID,
      expectedSlug: SLUG,
      mirror: {
        sanityId: PROVIDER_ID,
        name: "Swedish Lunch Pilot",
        slug: "wrong-slug",
      },
      mode: "apply",
    });

    expect(result.blockerCode).toBe("PROVIDER_MIRROR_SLUG_MISMATCH");
    expect(result.applyBlocked).toBe(true);
    expect(result.errorCode).toBe("provider_mirror_slug_mismatch");
  });

  it("flags unresolved providerRef when mirror lacks slug", () => {
    const result = validateProviderMirrorForGeneratorApply({
      providerId: PROVIDER_ID,
      expectedSlug: SLUG,
      mirror: {
        sanityId: PROVIDER_ID,
        name: "Swedish Lunch Pilot",
        slug: "",
      },
      mode: "apply",
    });

    expect(result.blockerCode).toBe("PROVIDER_REF_UNRESOLVED");
    expect(result.applyBlocked).toBe(true);
  });

  it("passes when mirror id and slug match", () => {
    const result = validateProviderMirrorForGeneratorApply({
      providerId: PROVIDER_ID,
      expectedSlug: SLUG,
      mirror: {
        sanityId: PROVIDER_ID,
        name: "Swedish Lunch Pilot",
        slug: SLUG,
      },
      mode: "dry_run",
    });

    expect(result.ok).toBe(true);
    expect(result.applyBlocked).toBe(false);
    expect(result.safeToApply).toBe(true);
    expect(result.mirrorSnapshot?.slug).toBe(SLUG);
  });
});
