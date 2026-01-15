import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const window = url.searchParams.get("window");
  const today = new Date().toISOString().slice(0, 10);

  if (!window) {
    return NextResponse.json({ error: "Missing window param" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      delivery_window,
      note,
      company_locations (
        name,
        delivery_contact_name,
        delivery_contact_phone,
        delivery_contact_country,
        companies ( name )
      ),
      profiles ( full_name, department )
    `)
    .eq("delivery_date", today)
    .eq("status", "active")
    .eq("delivery_window", window);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    "Leveringsvindu",
    "Firma",
    "Lokasjon",
    "Kontakt",
    "Telefon",
    "Ansatt",
    "Avdeling",
    "Notat",
  ];

  const rows = (data ?? []).map((o: any) => [
    o.delivery_window,
    o.company_locations.companies.name,
    o.company_locations.name,
    o.company_locations.delivery_contact_name ?? "",
    `${o.company_locations.delivery_contact_country ?? ""} ${o.company_locations.delivery_contact_phone ?? ""}`.trim(),
    o.profiles.full_name,
    o.profiles.department ?? "",
    o.note ?? "",
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="driver_${today}_${window}.csv"`,
    },
  });
}
