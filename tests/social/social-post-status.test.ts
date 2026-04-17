import { describe, expect, test } from "vitest";

import {
  canTransitionSocialPostStatus,
  normalizeSocialPostStatus,
} from "@/lib/social/socialPostStatusCanonical";

describe("social post status (2D1 canonical)", () => {
  test("normalizes unknown to draft", () => {
    expect(normalizeSocialPostStatus("")).toBe("draft");
    expect(normalizeSocialPostStatus("bogus")).toBe("draft");
  });

  test("draft -> in_review allowed", () => {
    expect(canTransitionSocialPostStatus("draft", "in_review")).toBe(true);
    expect(canTransitionSocialPostStatus("planned", "in_review")).toBe(true);
  });

  test("in_review -> approved and back to draft", () => {
    expect(canTransitionSocialPostStatus("in_review", "approved")).toBe(true);
    expect(canTransitionSocialPostStatus("in_review", "draft")).toBe(true);
  });

  test("approved -> scheduled", () => {
    expect(canTransitionSocialPostStatus("approved", "scheduled")).toBe(true);
    expect(canTransitionSocialPostStatus("ready", "scheduled")).toBe(true);
  });

  test("scheduled -> published blocked in PATCH (use publish API)", () => {
    expect(canTransitionSocialPostStatus("scheduled", "published")).toBe(false);
  });

  test("scheduled -> failed allowed", () => {
    expect(canTransitionSocialPostStatus("scheduled", "failed")).toBe(true);
  });

  test("published is terminal", () => {
    expect(canTransitionSocialPostStatus("published", "cancelled")).toBe(false);
  });
});
