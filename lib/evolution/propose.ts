import type { EvolutionIssue, Proposal } from "./types";

/**
 * Maps a detected issue to a human-readable proposal (no code changes).
 */
export function proposeFix(issue: EvolutionIssue): Proposal {
  if (issue.type === "duplication") {
    return {
      proposal: "Extract shared module or consolidate same-named files after review",
      impact: "maintainability",
      risk: "low",
      issue,
    };
  }

  if (issue.type === "coupling") {
    return {
      proposal: "Introduce a narrow abstraction or facades for the hot import; reduce direct fan-in",
      impact: "scalability",
      risk: "medium",
      issue,
    };
  }

  if (issue.type === "large_file") {
    return {
      proposal: "Split large file by concern (UI vs data vs helpers) without changing public APIs",
      impact: "maintainability",
      risk: "medium",
      issue,
    };
  }

  if (issue.type === "repeated_api_pattern") {
    return {
      proposal: "Standardize on lib/api/client or lib/core/fetchSafe for new call sites; migrate gradually",
      impact: "consistency",
      risk: "low",
      issue,
    };
  }

  if (issue.type === "repeated_db_pattern") {
    return {
      proposal: "Centralize table access in a thin repository module per bounded context",
      impact: "maintainability",
      risk: "medium",
      issue,
    };
  }

  if (issue.type === "repeated_business_logic") {
    return {
      proposal: "Document invariants and extract pure helpers where duplication is proven",
      impact: "correctness",
      risk: "medium",
      issue,
    };
  }

  return {
    proposal: "observe",
    impact: "none",
    risk: "low",
    issue,
  };
}
