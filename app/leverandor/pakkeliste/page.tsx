// app/leverandor/pakkeliste/page.tsx — provider-eid pakkeliste (Fase 7).
// Print-vennlig produksjonsgrunnlag gruppert dato → firma → lokasjon, med
// allergener/spesialbehov og leveringsinstruksjoner. CANCELLED er aldri med.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { osloTodayISODate, addDaysISO, isIsoDate } from "@/lib/date/oslo";
import { formatDateNO } from "@/lib/date/format";
import { loadProviderPackingList } from "@/lib/providers/packingList";

export default async function PakkelistePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fpakkeliste");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const sp = await searchParams;
  const dateRaw = typeof sp.date === "string" ? sp.date.trim() : "";
  const date = isIsoDate(dateRaw) ? dateRaw : osloTodayISODate();
  const list = await loadProviderPackingList(provider.id, date);

  return (
    <div className="ds-container mx-auto w-full max-w-[1100px] px-4 py-6 print:max-w-none print:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4 print:block">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 print:hidden">Pakkeliste</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Pakkeliste {formatDateNO(date)} — {provider.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {list.totalPortions} porsjoner · {list.groups.length} leveringssteder · kansellerte ordre er ikke med
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link
            href={`/leverandor/pakkeliste?date=${addDaysISO(date, -1)}`}
            className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold"
          >
            Forrige dag
          </Link>
          <Link
            href={`/leverandor/pakkeliste?date=${addDaysISO(date, 1)}`}
            className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold"
          >
            Neste dag
          </Link>
          <a
            href={`/api/provider/packing-list?date=${date}&format=csv`}
            className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold"
          >
            Last ned CSV
          </a>
        </div>
      </header>

      {list.groups.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">
          Ingen aktive ordre å pakke for {formatDateNO(date)}.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {list.groups.map((g) => (
            <section
              key={`${g.companyId}-${g.locationId ?? ""}`}
              className="break-inside-avoid rounded-2xl border border-neutral-200 bg-white p-5 print:rounded-none print:border-x-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-950">
                    {g.companyName}
                    {g.locationName ? ` · ${g.locationName}` : ""}
                  </h2>
                  {g.address ? <p className="mt-1 text-sm text-neutral-600">{g.address}</p> : null}
                  {g.windowFrom || g.windowTo ? (
                    <p className="text-sm text-neutral-600">
                      Leveringsvindu: {g.windowFrom ?? "—"}–{g.windowTo ?? "—"}
                    </p>
                  ) : null}
                  {g.contactName || g.contactPhone ? (
                    <p className="text-sm text-neutral-600">
                      Kontakt: {[g.contactName, g.contactPhone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {g.deliveryInstructions ? (
                    <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      Leveringsinstruksjoner: {g.deliveryInstructions}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-neutral-950">{g.portions}</p>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">porsjoner</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {g.productTotals.map((t) => (
                  <span key={t.productName} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800">
                    {t.productName}: {t.quantity}
                  </span>
                ))}
              </div>

              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="py-1 pr-3">Ansatt</th>
                    <th className="py-1 pr-3">Produkt</th>
                    <th className="py-1 pr-3">Antall</th>
                    <th className="py-1 pr-3">Allergener / spesialbehov</th>
                    <th className="py-1">Notat</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map((line, i) => (
                    <tr key={`${line.orderId}-${i}`} className="border-b border-neutral-100 align-top">
                      <td className="py-1.5 pr-3">{line.employeeName ?? "—"}</td>
                      <td className="py-1.5 pr-3">{line.productName}</td>
                      <td className="py-1.5 pr-3">{line.quantity}</td>
                      <td className="py-1.5 pr-3">
                        {[
                          line.allergens.length ? `Meny: ${line.allergens.join(", ")}` : null,
                          line.profileAllergenCodes.length ? `Profil: ${line.profileAllergenCodes.join(", ")}` : null,
                          line.profileAllergenNote ? `Notat til kjøkkenet: ${line.profileAllergenNote}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="py-1.5">{line.orderNote ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
