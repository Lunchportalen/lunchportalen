/**
 * AI PLATFORM HEALTH ENGINE
 * Overvåker: feil, ytelse, systemdrift.
 * Samler detectSystemErrors, detectPerformanceRegression, detectModelDrift.
 * Kun overvåking/analyse; ingen mutasjon.
 */

import { detectSystemErrors } from "@/lib/ai/capabilities/detectSystemErrors";
import type {
  DetectSystemErrorsInput,
  DetectSystemErrorsOutput,
  ErrorEntry,
  DetectedError,
} from "@/lib/ai/capabilities/detectSystemErrors";
import { detectPerformanceRegression } from "@/lib/ai/capabilities/detectPerformanceRegression";
import type {
  DetectPerformanceRegressionInput,
  DetectPerformanceRegressionOutput,
  PerformanceMetricInput,
  MetricRegressionResult,
} from "@/lib/ai/capabilities/detectPerformanceRegression";
import { detectModelDrift } from "@/lib/ai/capabilities/detectModelDrift";
import type {
  DetectModelDriftInput,
  DetectModelDriftOutput,
  DriftStats,
} from "@/lib/ai/capabilities/detectModelDrift";

export type { ErrorEntry, DetectedError, PerformanceMetricInput, MetricRegressionResult, DriftStats };

/** Overvåker feil: aggregerer feillogger, alvorlighet og anbefalte tiltak. */
export function monitorErrors(input: DetectSystemErrorsInput): DetectSystemErrorsOutput {
  return detectSystemErrors(input);
}

/** Overvåker ytelse: sammenligner nåværende mål med baseline, flagger regresjon. */
export function monitorPerformance(
  input: DetectPerformanceRegressionInput
): DetectPerformanceRegressionOutput {
  return detectPerformanceRegression(input);
}

/** Overvåker systemdrift: sammenligner nylige scores med baseline (mean/varians). */
export function monitorSystemDrift(input: DetectModelDriftInput): DetectModelDriftOutput {
  return detectModelDrift(input);
}

/** Type for dispatch. */
export type HealthEngineKind = "errors" | "performance" | "system_drift";

export type HealthEngineInput =
  | { kind: "errors"; input: DetectSystemErrorsInput }
  | { kind: "performance"; input: DetectPerformanceRegressionInput }
  | { kind: "system_drift"; input: DetectModelDriftInput };

export type HealthEngineResult =
  | { kind: "errors"; data: DetectSystemErrorsOutput }
  | { kind: "performance"; data: DetectPerformanceRegressionOutput }
  | { kind: "system_drift"; data: DetectModelDriftOutput };

/**
 * Samlet dispatch: feil, ytelse, systemdrift.
 */
export function runHealthEngine(req: HealthEngineInput): HealthEngineResult {
  switch (req.kind) {
    case "errors":
      return { kind: "errors", data: monitorErrors(req.input) };
    case "performance":
      return { kind: "performance", data: monitorPerformance(req.input) };
    case "system_drift":
      return { kind: "system_drift", data: monitorSystemDrift(req.input) };
    default:
      throw new Error(`Unknown health engine kind: ${(req as HealthEngineInput).kind}`);
  }
}
