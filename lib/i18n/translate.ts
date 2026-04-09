/**
 * Minimal deterministic copy helper (no external calls). Additive i18n stub.
 */
export function translate(text: string, lang: string): string {
  const dict: Record<string, string> = {
    no: text,
    en: `[EN] ${text}`,
  };
  const k = String(lang ?? "no").toLowerCase();
  return dict[k] ?? text;
}
