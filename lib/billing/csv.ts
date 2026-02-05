// lib/billing/csv.ts
function esc(v: any) {
  const s = String(v ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type InvoiceRow = {
  company_id: string;
  company_name: string;
  location_id: string | null;
  location_name: string | null;
  date: string; // YYYY-MM-DD
  slot: string | null;
  plan_tier: "BASIS" | "LUXUS";
  qty: number;
  unit_price_nok: number;
  amount_nok: number;
};

export function toCsv(rows: InvoiceRow[]) {
  const header = [
    "company_id",
    "company_name",
    "location_id",
    "location_name",
    "date",
    "slot",
    "plan_tier",
    "qty",
    "unit_price_nok",
    "amount_nok",
  ];

  const lines = [header.join(",")];

  for (const r of rows) {
    lines.push(
      [
        r.company_id,
        r.company_name,
        r.location_id ?? "",
        r.location_name ?? "",
        r.date,
        r.slot ?? "",
        r.plan_tier,
        String(r.qty),
        String(r.unit_price_nok),
        String(r.amount_nok),
      ]
        .map(esc)
        .join(",")
    );
  }

  return lines.join("\n") + "\n";
}
