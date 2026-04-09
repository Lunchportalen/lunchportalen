/**
 * Minimering og maskering av PII i logger (GDPR / SOC2-vennlig).
 */

export function maskEmail(email: string | null | undefined): string {
  const s = String(email ?? "").trim();
  if (!s.includes("@")) return "***";
  return s.replace(/(^.).*(@.*$)/, "$1***$2");
}

export function maskPhone(phone: string | null | undefined): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}
