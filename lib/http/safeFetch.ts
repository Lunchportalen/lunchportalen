// STATUS: KEEP

export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string; detail?: any }> {
  try {
    const res = await fetch(input, { ...init, cache: "no-store" });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text };
    }

    // Honor contract only; ambiguous response must not be reported as success.
    if (json && typeof json === "object") {
      if (json.ok === true && "data" in json) return { ok: true, data: json.data as T };
      if (json.ok === false) return { ok: false, error: json.message ?? "API_ERROR", detail: json };
    }

    if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, detail: json };
    // Fail-closed: response shape did not match { ok: true, data }; do not report success.
    return { ok: false, error: "BAD_RESPONSE", detail: { status: res.status, body: json } };
  } catch (e: any) {
    return { ok: false, error: "FETCH_FAILED", detail: String(e?.message ?? e) };
  }
}
