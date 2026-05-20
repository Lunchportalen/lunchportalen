/** Norwegian organisation number (9 digits) with mod11 control digit. */
export function digitsOnlyOrgnr(input: unknown): string {
  return String(input ?? "").replace(/\D/g, "");
}

export function isValidNorwegianOrgnr(input: unknown): boolean {
  const digits = digitsOnlyOrgnr(input);
  if (!/^\d{9}$/.test(digits)) return false;

  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * weights[i];
  const rem = sum % 11;
  const check = rem === 0 ? 0 : 11 - rem;
  if (check === 11) return Number(digits[8]) === 0;
  return check === Number(digits[8]);
}
