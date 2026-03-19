/**
 * Experiment model: types, status, id validation, status transitions.
 * Fail-closed: no silent fallback; valid transitions only.
 */

import { describe, test, expect } from "vitest";
import {
  isValidExperimentId,
  newExperimentId,
  isExperimentType,
  isExperimentStatus,
  type ExperimentStatus,
  type ExperimentType,
} from "@/lib/backoffice/experiments/model";

describe("experiment model", () => {
  describe("isValidExperimentId", () => {
    test("accepts alphanumeric, underscore, hyphen up to 80 chars", () => {
      expect(isValidExperimentId("exp_1")).toBe(true);
      expect(isValidExperimentId("exp-A")).toBe(true);
      expect(isValidExperimentId("a".repeat(80))).toBe(true);
    });

    test("rejects empty or invalid", () => {
      expect(isValidExperimentId("")).toBe(false);
      expect(isValidExperimentId("exp space")).toBe(false);
      expect(isValidExperimentId("exp/slash")).toBe(false);
      expect(isValidExperimentId("a".repeat(81))).toBe(false);
    });
  });

  describe("newExperimentId", () => {
    test("returns string starting with exp_", () => {
      const id = newExperimentId();
      expect(typeof id).toBe("string");
      expect(id.startsWith("exp_")).toBe(true);
    });

    test("returns unique ids on multiple calls", () => {
      const a = newExperimentId();
      const b = newExperimentId();
      expect(a).not.toBe(b);
    });
  });

  describe("isExperimentType", () => {
    test("accepts headline, cta, hero_body", () => {
      expect(isExperimentType("headline")).toBe(true);
      expect(isExperimentType("cta")).toBe(true);
      expect(isExperimentType("hero_body")).toBe(true);
    });

    test("rejects invalid types", () => {
      expect(isExperimentType("")).toBe(false);
      expect(isExperimentType("other")).toBe(false);
      expect(isExperimentType(null)).toBe(false);
      expect(isExperimentType(1)).toBe(false);
    });
  });

  describe("isExperimentStatus", () => {
    test("accepts draft, active, paused, completed", () => {
      (["draft", "active", "paused", "completed"] as ExperimentStatus[]).forEach((s) => {
        expect(isExperimentStatus(s)).toBe(true);
      });
    });

    test("rejects invalid status", () => {
      expect(isExperimentStatus("")).toBe(false);
      expect(isExperimentStatus("running")).toBe(false);
      expect(isExperimentStatus(null)).toBe(false);
    });
  });

  describe("status transitions (model allows any valid status)", () => {
    test("all valid statuses are recognized for PATCH updates", () => {
      const statuses: ExperimentStatus[] = ["draft", "active", "paused", "completed"];
      statuses.forEach((s) => expect(isExperimentStatus(s)).toBe(true));
    });
  });
});
