export function monthStartISO(isoDate: string) {
  // isoDate: YYYY-MM-DD
  const [y, m] = isoDate.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  return `${y}-${mm}-01`;
}

export function isISODate(d: any): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}
