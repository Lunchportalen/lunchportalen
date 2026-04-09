/**
 * Architecture evolution — shared types (analysis only; no production mutations).
 */

export type IssueType =
  | "duplication"
  | "coupling"
  | "large_file"
  | "repeated_api_pattern"
  | "repeated_db_pattern"
  | "repeated_business_logic";

export type Severity = "low" | "medium" | "high";

export type EvolutionIssue = {
  type: IssueType;
  target: string;
  severity: Severity;
  detail?: string;
  metrics?: Record<string, number | string>;
};

export type AnalysisResult = {
  issues: EvolutionIssue[];
  generated_at: string;
  root: string;
  files_scanned: number;
};

export type Proposal = {
  proposal: string;
  impact: string;
  risk: "low" | "medium" | "high";
  issue: EvolutionIssue;
};

export type ExperimentResult = {
  success: boolean;
  /** Simulated 0..1 improvement score (no production code touched). */
  improvement: number;
  notes?: string;
};

export type Decision = "apply" | "reject" | "ignore";

export type EvolutionStep = {
  issue: EvolutionIssue;
  proposal: Proposal;
  result: ExperimentResult;
  decision: Decision;
};

export type EvolutionRunResult = {
  generated_at: string;
  steps: EvolutionStep[];
};
