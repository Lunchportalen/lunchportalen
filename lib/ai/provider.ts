import "server-only";

/**
 * Inference layer: capability check and optional LLM call.
 * Tool selection and policy live in lib/ai/tools/registry; request/response contract in lib/ai/contracts.
 * Provider calls are centralized here; errors are never thrown and success shape is always normalized.
 */

export type AISuggestInput = {
  tool: string;
  locale: "nb" | "en";
  input?: Record<string, unknown>;
};

export type AISuggestOutput =
  | {
      ok: true;
      data: Record<string, unknown>;
      usage?: { promptTokens: number; completionTokens: number };
      model?: string;
      /** Only set on failure branch; optional here to allow safe union access. */
      error?: string;
    }
  | { ok: false; error: string };

/** Canonical provider error codes. Routes map these to HTTP (e.g. AI_DISABLED → 503). */
export const AI_PROVIDER_ERROR = {
  AI_DISABLED: "AI_DISABLED",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
} as const;

export type AiProviderErrorCode = (typeof AI_PROVIDER_ERROR)[keyof typeof AI_PROVIDER_ERROR];

/** Config view for logging/status only. Never includes key value. */
export type AiProviderConfigView = {
  enabled: boolean;
  provider: string;
  model: string;
  /** Set when enabled is false so callers can log reason without leaking secrets. */
  errorCode?: "MISSING_KEY" | "MISSING_PROVIDER";
};

const DEFAULT_MODEL = "bootstrap";

/** When AI_MODEL is "bootstrap" or unset, use this for OpenAI. Explicit override via AI_MODEL. */
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

/** Timeout for provider HTTP call. */
const PROVIDER_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Canonical env: AI_PROVIDER, AI_API_KEY.
 * Backward-compat: OPENAI_API_KEY used as key fallback; when only OPENAI_API_KEY is set, provider is inferred as "openai".
 * Model: AI_MODEL or default. Returns config view only (no key); invalid config → enabled false + errorCode.
 */
export function getAiProviderConfig(): AiProviderConfigView {
  const keyRaw = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const key = typeof keyRaw === "string" ? keyRaw.trim() : "";
  const keyPresent = key.length > 0;
  const providerRaw = process.env.AI_PROVIDER ?? "";
  const providerTrimmed = typeof providerRaw === "string" ? providerRaw.trim() : "";
  const provider =
    providerTrimmed !== ""
      ? providerTrimmed
      : keyPresent && (process.env.OPENAI_API_KEY ?? "").trim() !== ""
        ? "openai"
        : "";
  const modelRaw = process.env.AI_MODEL ?? "";
  const model = typeof modelRaw === "string" && modelRaw.trim() ? modelRaw.trim() : DEFAULT_MODEL;

  if (!keyPresent) {
    return { enabled: false, provider: provider || "(inferred)", model, errorCode: "MISSING_KEY" };
  }
  if (!provider) {
    return { enabled: false, provider: "", model, errorCode: "MISSING_PROVIDER" };
  }
  return { enabled: true, provider, model };
}

export function isAIEnabled(): boolean {
  const config = getAiProviderConfig();
  if (process.env.NODE_ENV === "development") {
    console.log("[AI_PROVIDER] capability", {
      provider: config.provider ? `${config.provider.slice(0, 2)}***` : "(empty)",
      enabled: config.enabled,
      errorCode: config.errorCode ?? null,
    });
  }
  return config.enabled;
}

/** Normalize success branch so data is always a plain object and usage has valid numbers. Prevents provider quirks from leaking. */
function normalizeProviderSuccess(
  data: unknown,
  usage?: { promptTokens?: number; completionTokens?: number } | null,
  model?: string | null
): Extract<AISuggestOutput, { ok: true }> {
  const dataObj =
    data != null && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const promptTokens =
    typeof usage?.promptTokens === "number" && Number.isFinite(usage.promptTokens)
      ? usage.promptTokens
      : 0;
  const completionTokens =
    typeof usage?.completionTokens === "number" && Number.isFinite(usage.completionTokens)
      ? usage.completionTokens
      : 0;
  return {
    ok: true,
    data: dataObj,
    usage: { promptTokens, completionTokens },
    model: typeof model === "string" && model.trim() ? model.trim() : DEFAULT_MODEL,
  };
}

/**
 * Map raw provider result to AISuggestOutput. Use after any inference call so invalid or
 * provider-specific shapes never reach the suggest route or CMS.
 */
export function normalizeProviderResult(raw: unknown): AISuggestOutput {
  if (raw == null || typeof raw !== "object") {
    return { ok: false, error: AI_PROVIDER_ERROR.INVALID_RESPONSE };
  }
  const o = raw as Record<string, unknown>;
  if (o.ok === false) {
    const err = typeof o.error === "string" ? o.error : AI_PROVIDER_ERROR.PROVIDER_ERROR;
    return { ok: false, error: err };
  }
  if (o.ok === true) {
    return normalizeProviderSuccess(
      o.data,
      o.usage as { promptTokens?: number; completionTokens?: number } | undefined,
      (o.model as string) ?? undefined
    );
  }
  return { ok: false, error: AI_PROVIDER_ERROR.INVALID_RESPONSE };
}

/** Internal: resolve API key from env. Only used when config.enabled is already true. */
function getApiKey(): string {
  const keyRaw = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  return typeof keyRaw === "string" ? keyRaw.trim() : "";
}

/** Resolve model ID for OpenAI: bootstrap → OPENAI_DEFAULT_MODEL, else config model. */
function resolveOpenAIModel(configModel: string): string {
  return configModel === "bootstrap" || !configModel.trim() ? OPENAI_DEFAULT_MODEL : configModel;
}

/**
 * Call OpenAI Chat Completions; returns normalized shape or throws.
 * Throws on network error, 4xx/5xx (including 429), timeout, or malformed body.
 */
async function callOpenAIChat(
  req: AISuggestInput,
  config: AiProviderConfigView,
  apiKey: string
): Promise<{ ok: true; data: Record<string, unknown>; usage: { promptTokens: number; completionTokens: number }; model: string }> {
  const model = resolveOpenAIModel(config.model);
  const systemPrompt = `You are a CMS content suggestion assistant. Respond only with a single JSON object. The object may contain: summary (string), patch (object with version: 1 and ops: array), metaSuggestion (object with optional title, description), issues (array of { code, severity, message }), stats (object), or other keys as needed. No markdown, no explanation, only valid JSON.`;
  const userContent = `Tool: ${req.tool}. Locale: ${req.locale}. Input: ${JSON.stringify(req.input ?? {})}. Respond with one JSON object only.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text();
      if (process.env.NODE_ENV === "development" && body) {
        console.warn("[AI_PROVIDER] OpenAI non-OK", res.status, body.slice(0, 300));
      }
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenAI empty or missing content");
    }

    let data: unknown;
    try {
      data = JSON.parse(content) as unknown;
    } catch {
      throw new Error("OpenAI response is not valid JSON");
    }
    const dataObj =
      data != null && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    const usage = json?.usage;
    const promptTokens = typeof usage?.prompt_tokens === "number" && Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : 0;
    const completionTokens = typeof usage?.completion_tokens === "number" && Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : 0;

    return {
      ok: true as const,
      data: dataObj,
      usage: { promptTokens, completionTokens },
      model: typeof json?.model === "string" ? json.model : model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Call OpenAI with custom messages; returns parsed JSON object or throws. */
async function callOpenAIWithMessages(
  messages: Array<{ role: "system" | "user"; content: string }>,
  config: AiProviderConfigView,
  apiKey: string
): Promise<Record<string, unknown>> {
  const model = resolveOpenAIModel(config.model);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("OpenAI empty or missing content");
    const data = JSON.parse(content) as unknown;
    if (data == null || typeof data !== "object" || Array.isArray(data)) throw new Error("OpenAI response is not a JSON object");
    return data as Record<string, unknown>;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Editor text improve/shorten: real provider call. Preserves intent; improves clarity, tone, structure. */
export type SuggestEditorTextInput = { text: string; action: "improve" | "shorten"; locale: "nb" | "en" };
export type SuggestEditorTextOutput =
  | { ok: true; suggestion: string }
  | { ok: false; error: string };

export async function suggestEditorText(req: SuggestEditorTextInput): Promise<SuggestEditorTextOutput> {
  const config = getAiProviderConfig();
  if (!config.enabled) return { ok: false, error: AI_PROVIDER_ERROR.AI_DISABLED };
  const provider = (config.provider || "").toLowerCase();
  if (provider !== "openai") return { ok: false, error: AI_PROVIDER_ERROR.PROVIDER_ERROR };
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: AI_PROVIDER_ERROR.AI_DISABLED };
  const systemPrompt =
    req.locale === "en"
      ? "You are an editor assistant. Improve the user's text for clarity, tone, and structure while preserving intent. Respond with a single JSON object: { \"suggestion\": \"<improved text>\" }. No markdown, no explanation. For shorten: make it concise; for improve: polish and clarify."
      : "Du er en redaktørassistent. Forbedre brukerens tekst for klarhet, tone og struktur uten å endre intensjonen. Svar med ett JSON-objekt: { \"suggestion\": \"<forbedret tekst>\" }. Ingen markdown eller forklaring. For shorten: gjør den mer konsis; for improve: poler og tydeliggjør.";
  const userContent =
    req.action === "shorten"
      ? `Shorten (${req.locale}): ${req.text.slice(0, 2000)}`
      : `Improve (${req.locale}): ${req.text.slice(0, 2000)}`;
  try {
    const data = await callOpenAIWithMessages(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      config,
      apiKey
    );
    const suggestion = typeof data.suggestion === "string" ? data.suggestion.trim() : "";
    if (!suggestion) return { ok: false, error: AI_PROVIDER_ERROR.INVALID_RESPONSE };
    return { ok: true, suggestion };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not a JSON object") || msg.includes("empty or missing")) return { ok: false, error: AI_PROVIDER_ERROR.INVALID_RESPONSE };
    return { ok: false, error: AI_PROVIDER_ERROR.PROVIDER_ERROR };
  }
}

/** Editor CTA improve: real provider call. Improves conversion, clarity, action strength; preserves page relevance. */
export type SuggestCtaImproveInput = {
  title: string;
  body?: string;
  buttonLabel?: string;
  buttonHref?: string;
  action: string;
  locale: "nb" | "en";
};
export type CtaSuggestionShape = { title: string; body?: string; buttonLabel?: string; buttonHref?: string };
export type SuggestCtaImproveOutput =
  | { ok: true; suggestion: CtaSuggestionShape }
  | { ok: false; error: string };

export async function suggestCtaImprove(req: SuggestCtaImproveInput): Promise<SuggestCtaImproveOutput> {
  const config = getAiProviderConfig();
  if (!config.enabled) return { ok: false, error: AI_PROVIDER_ERROR.AI_DISABLED };
  const provider = (config.provider || "").toLowerCase();
  if (provider !== "openai") return { ok: false, error: AI_PROVIDER_ERROR.PROVIDER_ERROR };
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: AI_PROVIDER_ERROR.AI_DISABLED };
  const systemPrompt =
    req.locale === "en"
      ? "You are a conversion copywriter. Improve the CTA (title, body, buttonLabel, buttonHref) for conversion quality, clarity, and action strength. Keep it relevant to the page. Respond with a single JSON object with keys: title (string), body (string or omit), buttonLabel (string or omit), buttonHref (string or omit). No markdown. Preserve link in buttonHref if provided."
      : "Du er en konverteringskopywriter. Forbedre CTA (tittel, body, buttonLabel, buttonHref) for konvertering, klarhet og handlingsstyrke. Behold relevans til siden. Svar med ett JSON-objekt med nøkler: title, body (valgfri), buttonLabel (valgfri), buttonHref (valgfri). Ingen markdown. Behold lenke i buttonHref hvis oppgitt.";
  const userContent = `Action: ${req.action}. Locale: ${req.locale}. Current: title="${(req.title || "").slice(0, 120)}" body="${(req.body || "").slice(0, 200)}" buttonLabel="${(req.buttonLabel || "").slice(0, 60)}" buttonHref="${(req.buttonHref || "").slice(0, 200)}"`;
  try {
    const data = await callOpenAIWithMessages(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      config,
      apiKey
    );
    const title = typeof data.title === "string" ? data.title.trim().slice(0, 120) : (req.title || "").trim().slice(0, 120) || "Tittel";
    const body = typeof data.body === "string" ? data.body.trim().slice(0, 600) : undefined;
    const buttonLabel = typeof data.buttonLabel === "string" ? data.buttonLabel.trim().slice(0, 60) : undefined;
    const buttonHref = typeof data.buttonHref === "string" ? data.buttonHref.trim().slice(0, 2048) : undefined;
    return { ok: true, suggestion: { title, body, buttonLabel, buttonHref } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not a JSON object") || msg.includes("empty or missing")) return { ok: false, error: AI_PROVIDER_ERROR.INVALID_RESPONSE };
    return { ok: false, error: AI_PROVIDER_ERROR.PROVIDER_ERROR };
  }
}

/**
 * Single entry point for inference. Never throws; always returns normalized AISuggestOutput.
 * Invalid or missing config → AI_DISABLED. Provider throw or malformed response → PROVIDER_ERROR / INVALID_RESPONSE.
 * Rate limit, timeout, and network errors → PROVIDER_ERROR. Unparseable JSON → INVALID_RESPONSE.
 */
export async function suggestJSON(req: AISuggestInput): Promise<AISuggestOutput> {
  const config = getAiProviderConfig();
  if (!config.enabled) {
    return { ok: false, error: AI_PROVIDER_ERROR.AI_DISABLED };
  }

  const provider = (config.provider || "").toLowerCase();

  if (provider === "openai") {
    const apiKey = getApiKey();
    if (!apiKey) {
      return { ok: false, error: AI_PROVIDER_ERROR.AI_DISABLED };
    }
    try {
      const raw = await callOpenAIChat(req, config, apiKey);
      return normalizeProviderResult(raw);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isInvalidJson = message.includes("not valid JSON") || message.includes("empty or missing content");
      if (isInvalidJson) {
        return { ok: false, error: AI_PROVIDER_ERROR.INVALID_RESPONSE };
      }
      return { ok: false, error: AI_PROVIDER_ERROR.PROVIDER_ERROR };
    }
  }

  return { ok: false, error: AI_PROVIDER_ERROR.PROVIDER_ERROR };
}
