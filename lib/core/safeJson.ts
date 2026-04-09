/**
 * Trygg JSON-parse av fetch-respons (klient/server).
 */
export async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return { ok: false, parseError: true as const };
  }
}
