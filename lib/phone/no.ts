export function normalizeNoPhone(input: unknown): string {
  const digits = String(input ?? "").replace(/\D/g, "");

  if (digits.startsWith("0047") && digits.length === 12) return digits.slice(4);
  if (digits.startsWith("47") && digits.length === 10) return digits.slice(2);

  return digits;
}

export function isValidNoPhone(digits: string): boolean {
  return /^\d{8}$/.test(digits);
}
