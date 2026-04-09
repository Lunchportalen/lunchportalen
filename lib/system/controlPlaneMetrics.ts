import "server-only";

import {
  isStrictAi,
  isStrictCms,
  isStrictControlPlane,
  isStrictDsServer,
  isStrictMode,
} from "@/lib/system/controlStrict";

export type ControlWarning = {
  ts: number;
  domain: "ai" | "cms" | "ds";
  code: string;
  message: string;
  meta?: Record<string, unknown>;
};

const MAX_WARNINGS = 200;

const state = {
  aiApiEntrypointWraps: 0,
  runAiCalls: 0,
  runAiInsideEntryAtStart: 0,
  runAiImplicitBracket: 0,
  runAiStrictRejections: 0,
  cmsGateEnters: 0,
  cmsPagePatchMissingHeader: 0,
  cmsStrictRejections: 0,
  dsLegacyButtonFirstMount: 0,
  warnings: [] as ControlWarning[],
  posCyclesCompleted: 0,
  posCyclesSkippedCooldown: 0,
  posLastRunAt: null as number | null,
  posLastSource: null as string | null,
  posLastSurfaces: [] as string[],
  posLastExecutionKinds: [] as string[],
  posLastDecisionCount: null as number | null,
  posLastSignalPriority: null as string | null,
  posLastSkippedLowConfidence: null as number | null,
  posLastSuppressedDuplicates: null as number | null,
  posLastCappedSurfaces: null as number | null,
  posLastActiveSurfaces: null as number | null,
  posLastEffectiveMinConf: null as number | null,
  posLastEffectiveMaxActive: null as number | null,
};

function pushWarning(w: Omit<ControlWarning, "ts"> & { ts?: number }): void {
  const entry: ControlWarning = {
    ts: w.ts ?? Date.now(),
    domain: w.domain,
    code: w.code,
    message: w.message,
    meta: w.meta,
  };
  state.warnings.push(entry);
  if (state.warnings.length > MAX_WARNINGS) {
    state.warnings.splice(0, state.warnings.length - MAX_WARNINGS);
  }
}

export function recordAiApiEntrypointWrap(_surface: string, _method: string): void {
  state.aiApiEntrypointWraps += 1;
}

export function recordRunAiInvocation(hadEntryAtStart: boolean, implicitBracket: boolean): void {
  state.runAiCalls += 1;
  if (hadEntryAtStart) state.runAiInsideEntryAtStart += 1;
  if (implicitBracket) state.runAiImplicitBracket += 1;
}

export function recordRunAiStrictRejection(tool: string): void {
  state.runAiStrictRejections += 1;
  pushWarning({
    domain: "ai",
    code: "ai.strict_reject",
    message: "runAi blocked: outside decisionEngine entrypoint (strict mode)",
    meta: { tool },
  });
}

export function recordCmsGateEnter(_source: string): void {
  state.cmsGateEnters += 1;
}

export function recordCmsPagePatchMissingHeader(): void {
  state.cmsPagePatchMissingHeader += 1;
  pushWarning({
    domain: "cms",
    code: "cms.missing_workspace_header",
    message: "Page body PATCH without ContentWorkspace client header",
  });
}

export function recordCmsStrictRejection(reason: string): void {
  state.cmsStrictRejections += 1;
  pushWarning({
    domain: "cms",
    code: "cms.strict_reject",
    message: reason,
  });
}

export function recordDsLegacyButtonMount(): void {
  state.dsLegacyButtonFirstMount += 1;
}

export function recordAiBypassWarn(context: string, extra?: Record<string, unknown>): void {
  pushWarning({
    domain: "ai",
    code: "ai.bypass_warn",
    message: `AI entrypoint bypass: ${context}`,
    meta: extra,
  });
}

export function recordPosCycleComplete(meta: {
  source: string | null;
  surfaces: string[];
  executionKinds: string[];
  decisionCount: number;
  signalPriority?: string | null;
  skippedLowConfidence?: number;
  suppressedDuplicates?: number;
  cappedSurfaces?: number;
  activeNonObserveSurfaces?: number;
  effectiveMinConfidence?: number;
  effectiveMaxActive?: number;
}): void {
  state.posCyclesCompleted += 1;
  state.posLastRunAt = Date.now();
  state.posLastSource = meta.source;
  state.posLastSurfaces = [...meta.surfaces];
  state.posLastExecutionKinds = [...meta.executionKinds];
  state.posLastDecisionCount = meta.decisionCount;
  state.posLastSignalPriority = meta.signalPriority ?? null;
  state.posLastSkippedLowConfidence =
    typeof meta.skippedLowConfidence === "number" ? meta.skippedLowConfidence : null;
  state.posLastSuppressedDuplicates =
    typeof meta.suppressedDuplicates === "number" ? meta.suppressedDuplicates : null;
  state.posLastCappedSurfaces = typeof meta.cappedSurfaces === "number" ? meta.cappedSurfaces : null;
  state.posLastActiveSurfaces =
    typeof meta.activeNonObserveSurfaces === "number" ? meta.activeNonObserveSurfaces : null;
}

export function recordPosCycleSkipped(_reason: "cooldown"): void {
  state.posCyclesSkippedCooldown += 1;
}

export type ControlPlaneSnapshot = {
  strict: {
    strictMode: boolean;
    controlPlane: boolean;
    ai: boolean;
    cms: boolean;
    dsServer: boolean;
  };
  ai: {
    apiEntrypointWraps: number;
    runAiCalls: number;
    runAiInsideEntryAtStart: number;
    runAiImplicitBracket: number;
    runAiStrictRejections: number;
    /** 100 when no runAi yet; else share of runAi that had route-level entry before runner */
    compliancePercent: number;
    /** 100 minus implicit bracket share (goal: 0 implicit) */
    noImplicitBracketPercent: number;
  };
  cms: {
    gateEnters: number;
    pagePatchMissingHeader: number;
    strictRejections: number;
  };
  ds: {
    legacyButtonMountsRecorded: number;
    note: string;
  };
  warnings: ControlWarning[];
  warningsTotal: number;
  /** min(route-attributed runAi %, no-implicit-bracket %) */
  overallCompliancePercent: number;
  strictDsClientConfigured: boolean;
  pos: {
    cyclesCompleted: number;
    cyclesSkippedCooldown: number;
    lastRunAt: number | null;
    lastSource: string | null;
    lastSurfacesAffected: string[];
    lastExecutionKinds: string[];
    lastDecisionCount: number | null;
    lastSignalPriority: string | null;
    lastSkippedLowConfidence: number | null;
    lastSuppressedDuplicates: number | null;
    lastCappedSurfaces: number | null;
    lastActiveSurfaces: number | null;
    lastEffectiveMinConfidence: number | null;
    lastEffectiveMaxActive: number | null;
  };
};

export function getControlPlaneSnapshot(): ControlPlaneSnapshot {
  const { runAiCalls, runAiInsideEntryAtStart, runAiImplicitBracket } = state;
  const compliancePercent =
    runAiCalls === 0 ? 100 : Math.round((100 * runAiInsideEntryAtStart) / runAiCalls);
  const noImplicitBracketPercent =
    runAiCalls === 0 ? 100 : Math.round((100 * (runAiCalls - runAiImplicitBracket)) / runAiCalls);
  const overallCompliancePercent = Math.min(compliancePercent, noImplicitBracketPercent);
  const strictDsClientConfigured =
    /^(1|true|yes)$/i.test(String(process.env.NEXT_PUBLIC_LP_STRICT_DS ?? "").trim()) ||
    /^(1|true|yes)$/i.test(String(process.env.LP_STRICT_DS ?? "").trim());

  return {
    strict: {
      strictMode: isStrictMode(),
      controlPlane: isStrictControlPlane(),
      ai: isStrictAi(),
      cms: isStrictCms(),
      dsServer: isStrictDsServer(),
    },
    ai: {
      apiEntrypointWraps: state.aiApiEntrypointWraps,
      runAiCalls,
      runAiInsideEntryAtStart,
      runAiImplicitBracket,
      runAiStrictRejections: state.runAiStrictRejections,
      compliancePercent,
      noImplicitBracketPercent,
    },
    cms: {
      gateEnters: state.cmsGateEnters,
      pagePatchMissingHeader: state.cmsPagePatchMissingHeader,
      strictRejections: state.cmsStrictRejections,
    },
    ds: {
      legacyButtonMountsRecorded: state.dsLegacyButtonFirstMount,
      note: "DS compliance is primarily client-side; mount count is sampled when legacy Button fires.",
    },
    warnings: [...state.warnings].slice(-80),
    warningsTotal: state.warnings.length,
    overallCompliancePercent,
    strictDsClientConfigured,
    pos: {
      cyclesCompleted: state.posCyclesCompleted,
      cyclesSkippedCooldown: state.posCyclesSkippedCooldown,
      lastRunAt: state.posLastRunAt,
      lastSource: state.posLastSource,
      lastSurfacesAffected: [...state.posLastSurfaces],
      lastExecutionKinds: [...state.posLastExecutionKinds],
      lastDecisionCount: state.posLastDecisionCount,
      lastSignalPriority: state.posLastSignalPriority,
      lastSkippedLowConfidence: state.posLastSkippedLowConfidence,
      lastSuppressedDuplicates: state.posLastSuppressedDuplicates,
      lastCappedSurfaces: state.posLastCappedSurfaces,
      lastActiveSurfaces: state.posLastActiveSurfaces,
      lastEffectiveMinConfidence: state.posLastEffectiveMinConf,
      lastEffectiveMaxActive: state.posLastEffectiveMaxActive,
    },
  };
}

/** Sanitized POS snapshot for backoffice UI (no strict/compliance internals). */
export function getPosUiSnapshotForBackoffice(): {
  lastRunAt: number | null;
  lastSource: string | null;
  signalPriority: string | null;
  skippedLowConfidence: number | null;
  suppressedDuplicates: number | null;
  cappedSurfaces: number | null;
  activeSurfaces: number | null;
  lastSurfacesAffected: string[];
  lastExecutionKinds: string[];
  cyclesCompleted: number;
  effectiveMinConfidence: number | null;
  effectiveMaxActive: number | null;
} {
  return {
    lastRunAt: state.posLastRunAt,
    lastSource: state.posLastSource,
    signalPriority: state.posLastSignalPriority,
    skippedLowConfidence: state.posLastSkippedLowConfidence,
    suppressedDuplicates: state.posLastSuppressedDuplicates,
    cappedSurfaces: state.posLastCappedSurfaces,
    activeSurfaces: state.posLastActiveSurfaces,
    lastSurfacesAffected: [...state.posLastSurfaces],
    lastExecutionKinds: [...state.posLastExecutionKinds],
    cyclesCompleted: state.posCyclesCompleted,
    effectiveMinConfidence: state.posLastEffectiveMinConf,
    effectiveMaxActive: state.posLastEffectiveMaxActive,
  };
}
