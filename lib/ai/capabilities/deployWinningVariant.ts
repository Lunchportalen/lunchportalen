/**
 * Auto-deployment of winning experiments capability: deployWinningVariant.
 * Produces a deployment plan to promote the winning variant (complete experiment,
 * apply winning content to page/variant). Does not mutate data; output is consumed
 * by an authorized API or backoffice flow. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "deployWinningVariant";

const deployWinningVariantCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Auto-deployment of winning experiments: produces a deployment plan to promote the winning variant (complete experiment, apply winning content). Input: detection result or experimentId + winningVariant; optional pageId, variantId. Output: plan (status, steps, rollbackHint). Does not mutate; plan is executed by authorized system. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Deploy winning variant input",
    properties: {
      detectionResult: {
        type: "object",
        description: "Optional: output from detectWinningVariant; used to derive winningVariant and guard by hasWinner",
        properties: {
          hasWinner: { type: "boolean" },
          winningVariant: { type: "string" },
          runnerUp: { type: "string" },
          confidence: { type: "string" },
          reason: { type: "string" },
        },
      },
      experimentId: { type: "string", description: "Experiment identifier (required if detectionResult not provided)" },
      winningVariant: { type: "string", description: "Variant key/label to deploy (required if detectionResult not provided or to override)" },
      pageId: { type: "string", description: "Optional target page id for deployment" },
      variantId: { type: "string", description: "Optional target content_page_variants id" },
      locale: { type: "string", description: "Locale (nb | en) for plan messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Deployment plan for winning variant",
    required: ["status", "plan", "plannedAt"],
    properties: {
      status: { type: "string", enum: ["ready_for_deployment", "blocked"], description: "ready_for_deployment = plan may be executed; blocked = do not deploy" },
      experimentId: { type: "string" },
      winningVariant: { type: "string" },
      pageId: { type: "string" },
      variantId: { type: "string" },
      plan: {
        type: "object",
        required: ["steps", "rollbackHint", "message"],
        properties: {
          steps: {
            type: "array",
            items: { type: "string" },
            description: "Ordered steps for authorized system to execute",
          },
          rollbackHint: { type: "string" },
          message: { type: "string" },
        },
      },
      blockedReason: { type: "string", description: "Set when status is blocked" },
      plannedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    {
      code: "plan_only",
      description: "Output is a deployment plan only; actual deployment must be performed by an authorized system (e.g. API with auth).",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(deployWinningVariantCapability);

export type DetectionResultLike = {
  hasWinner?: boolean;
  winningVariant?: string;
  runnerUp?: string;
  confidence?: string;
  reason?: string;
};

export type DeployWinningVariantInput = {
  detectionResult?: DetectionResultLike | null;
  experimentId?: string | null;
  winningVariant?: string | null;
  pageId?: string | null;
  variantId?: string | null;
  locale?: "nb" | "en" | null;
};

export type DeployWinningVariantPlan = {
  steps: string[];
  rollbackHint: string;
  message: string;
};

export type DeployWinningVariantOutput = {
  status: "ready_for_deployment" | "blocked";
  experimentId: string;
  winningVariant: string;
  pageId: string;
  variantId: string;
  plan: DeployWinningVariantPlan;
  blockedReason: string;
  plannedAt: string;
};

/**
 * Produces a deployment plan for the winning variant. Does not perform deployment.
 * Deterministic; no external calls.
 */
export function deployWinningVariant(input: DeployWinningVariantInput = {}): DeployWinningVariantOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const detection = input.detectionResult;

  const experimentId = (input.experimentId ?? "").trim();
  let winningVariant = (input.winningVariant ?? detection?.winningVariant ?? "").trim();
  const pageId = (input.pageId ?? "").trim();
  const variantId = (input.variantId ?? "").trim();

  if (detection && typeof detection.hasWinner === "boolean" && !detection.hasWinner) {
    const blockedReason = isEn
      ? "No winner to deploy (detection hasWinner is false)."
      : "Ingen vinner å deploye (detection hasWinner er false).";
    return {
      status: "blocked",
      experimentId: experimentId || "",
      winningVariant: "",
      pageId,
      variantId,
      plan: {
        steps: [],
        rollbackHint: isEn ? "N/A — deployment was not executed." : "N/A — deploy ble ikke kjørt.",
        message: blockedReason,
      },
      blockedReason,
      plannedAt: new Date().toISOString(),
    };
  }

  if (detection?.winningVariant && !winningVariant) {
    winningVariant = String(detection.winningVariant).trim();
  }

  if (!winningVariant) {
    const blockedReason = isEn
      ? "Missing winningVariant (provide detectionResult.winningVariant or winningVariant)."
      : "Mangler winningVariant (angi detectionResult.winningVariant eller winningVariant).";
    return {
      status: "blocked",
      experimentId: experimentId || "",
      winningVariant: "",
      pageId,
      variantId,
      plan: {
        steps: [],
        rollbackHint: isEn ? "N/A." : "N/A.",
        message: blockedReason,
      },
      blockedReason,
      plannedAt: new Date().toISOString(),
    };
  }

  const steps: string[] = [];
  steps.push(
    isEn
      ? `Mark experiment ${experimentId || "(experiment_id)"} as completed.`
      : `Merk eksperiment ${experimentId || "(experiment_id)"} som fullført.`
  );
  steps.push(
    isEn
      ? `Apply winning variant "${winningVariant}" content to the target page/variant (e.g. copy variant blocks to default or create release).`
      : `Bruk innhold fra vinnervariant «${winningVariant}» på målside/variant (f.eks. kopier variant-blokker til default eller opprett release).`
  );
  if (pageId) {
    steps.push(isEn ? `Target page_id: ${pageId}.` : `Mål page_id: ${pageId}.`);
  }
  if (variantId) {
    steps.push(isEn ? `Target variant_id: ${variantId}.` : `Mål variant_id: ${variantId}.`);
  }
  steps.push(
    isEn
      ? "Persist changes via authorized API (e.g. PATCH experiment status, then release or variant update)."
      : "Lagre endringer via autorisert API (f.eks. PATCH eksperimentstatus, deretter release eller variant-oppdatering)."
  );

  const rollbackHint = isEn
    ? `Revert to runner-up or previous default variant; optionally set experiment status back to active/paused if needed.`
    : `Tilbakestill til nest beste eller forrige default-variant; sett eventuelt eksperimentstatus tilbake til active/paused.`;

  const message = isEn
    ? `Deployment plan ready: promote "${winningVariant}" for experiment ${experimentId || "(set experimentId)"}. Execute steps via authorized system.`
    : `Deployplan klar: promover «${winningVariant}» for eksperiment ${experimentId || "(angi experimentId)"}. Utfør steg via autorisert system.`;

  return {
    status: "ready_for_deployment",
    experimentId: experimentId || "",
    winningVariant,
    pageId,
    variantId,
    plan: { steps, rollbackHint, message },
    blockedReason: "",
    plannedAt: new Date().toISOString(),
  };
}

export { deployWinningVariantCapability, CAPABILITY_NAME };
