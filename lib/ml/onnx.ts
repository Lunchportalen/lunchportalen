import "server-only";

import fs from "node:fs";
import path from "node:path";

import { opsLog } from "@/lib/ops/log";

/** Default I/O names — override via LP_ONNX_INPUT_NAME / LP_ONNX_OUTPUT_NAME if model differs. */
const DEFAULT_INPUT = "input";
const DEFAULT_OUTPUT = "output";

/** Structural type only — avoids pulling `onnxruntime-node` into the serverless trace via `import("…").Type`. */
type OnnxInferenceSession = {
  run(feeds: Record<string, unknown>): Promise<Record<string, unknown>>;
};

type OrtModule = {
  Tensor: new (type: string, data: Float32Array, dims: readonly number[]) => unknown;
  InferenceSession: { create: (path: string) => Promise<OnnxInferenceSession> };
};

let session: OnnxInferenceSession | null = null;
let sessionPromise: Promise<OnnxInferenceSession | null> | null = null;
let lastLoadError: string | null = null;

/** ONNX native bindings are not shipped on Vercel serverless (size limit); optional ONNX is skipped there. */
function isOnnxRuntimeEnvironmentSupported(): boolean {
  return process.env.VERCEL !== "1";
}

export function isOnnxFeatureEnabled(): boolean {
  return String(process.env.LP_ONNX_ENABLED ?? "").trim() === "true";
}

function modelPath(): string {
  const p = String(process.env.LP_ONNX_MODEL_PATH ?? "").trim();
  if (p) return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return path.join(process.cwd(), "model.onnx");
}

/**
 * Loads ONNX model once (fail-soft: returns null if disabled, missing file, or load error).
 * All failures are logged for SOC2 traceability; callers must fall back to deterministic predictors.
 */
export async function loadModel(): Promise<OnnxInferenceSession | null> {
  if (!isOnnxFeatureEnabled()) {
    return null;
  }
  if (!isOnnxRuntimeEnvironmentSupported()) {
    return null;
  }
  if (session) return session;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const mp = modelPath();
    if (!fs.existsSync(mp)) {
      lastLoadError = `missing_model:${mp}`;
      opsLog("onnx_load", { ok: false, reason: lastLoadError });
      return null;
    }
    try {
      const ort = (await import("onnxruntime-node")) as OrtModule;
      const s = await ort.InferenceSession.create(mp);
      session = s;
      lastLoadError = null;
      opsLog("onnx_load", { ok: true, path: mp });
      return s;
    } catch (e) {
      lastLoadError = e instanceof Error ? e.message : String(e);
      opsLog("onnx_load", { ok: false, error: lastLoadError });
      return null;
    } finally {
      sessionPromise = null;
    }
  })();

  return sessionPromise;
}

export function getOnnxLoadDiagnostics(): { lastError: string | null; modelPath: string } {
  return { lastError: lastLoadError, modelPath: modelPath() };
}

/**
 * Runs inference on a 1×N float feature row. Returns null if ONNX unavailable (caller must fallback).
 */
export async function runModel(input: Float32Array): Promise<Float32Array | null> {
  const s = await loadModel();
  if (!s) return null;

  const ort = (await import("onnxruntime-node")) as OrtModule;
  const inputName = String(process.env.LP_ONNX_INPUT_NAME ?? DEFAULT_INPUT).trim() || DEFAULT_INPUT;
  const outputName = String(process.env.LP_ONNX_OUTPUT_NAME ?? DEFAULT_OUTPUT).trim() || DEFAULT_OUTPUT;

  const tensor = new ort.Tensor("float32", input, [1, input.length]);
  try {
    const results = await s.run({ [inputName]: tensor });
    const out = results[outputName];
    if (!out || typeof out !== "object" || !("data" in out)) {
      opsLog("onnx_run", { ok: false, reason: "missing_output", outputName });
      return null;
    }
    const data = (out as { data: unknown }).data;
    if (data instanceof Float32Array) return data;
    if (data instanceof Float64Array) return Float32Array.from(data);
    opsLog("onnx_run", { ok: false, reason: "unexpected_output_dtype" });
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("onnx_run", { ok: false, error: msg });
    return null;
  }
}

/** Clears session (tests / rollback of in-memory state only). */
export async function resetOnnxSessionForTests(): Promise<void> {
  session = null;
  sessionPromise = null;
  lastLoadError = null;
}
