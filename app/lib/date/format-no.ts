export function formatDateNO(isoDate: string) {
  const [y, m, d] = String(isoDate ?? "").split("-");
  if (!y || !m || !d) return String(isoDate ?? "");
  return `${d}-${m}-${y}`; // DD-MM-YYYY
}
