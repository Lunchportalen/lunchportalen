function esc(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Record<string, any>[], headers: string[]) {
  const head = headers.map(esc).join(",");
  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return [head, ...lines].join("\n");
}
