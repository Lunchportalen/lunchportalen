// app/menus/week/page.tsx
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { weekRangeISO, weekRangeISOFrom } from "@/lib/date/week";
import { getMenuForDatesAdmin, type SanityMenuDay } from "@/lib/sanity/queries";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function dayNameNO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  return d.toLocaleDateString("nb-NO", { weekday: "long" });
}

function prettyDateNO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short" });
}

function chipClass(kind: "ok" | "warn" | "crit" | "neutral") {
  if (kind === "ok") return "lp-chip";
  if (kind === "warn") return "lp-chip lp-chip-warn";
  if (kind === "crit") return "lp-chip lp-chip-crit";
  return "lp-chip";
}

function computeStatus(menu: SanityMenuDay | undefined) {
  if (!menu) {
    return {
      chips: [{ label: "Mangler", kind: "crit" as const }],
      hasGaps: true,
    };
  }

  const approved = menu.approvedForPublish === true;
  const visible = menu.customerVisible === true;
  const published = menu.isPublished === true; // computed i query

  const hasTitle = !!(menu.title && menu.title.trim().length > 0);
  const hasDesc = !!(menu.description && menu.description.trim().length > 0);

  const chips: Array<{ label: string; kind: "ok" | "warn" | "crit" | "neutral" }> = [];

  // Kvalitet
  if (!hasTitle || !hasDesc) chips.push({ label: "Ufullstendig", kind: "warn" });

  // Status
  chips.push(published ? { label: "Publisert", kind: "ok" } : { label: "Ikke publisert", kind: "warn" });
  chips.push(approved ? { label: "Godkjent", kind: "ok" } : { label: "Ikke godkjent", kind: "neutral" });
  chips.push(visible ? { label: "Synlig for kunder", kind: "ok" } : { label: "Skjult for kunder", kind: "neutral" });

  return { chips, hasGaps: !hasTitle || !hasDesc };
}

export default async function MenusWeekPage(props: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = props.searchParams ?? {};
  const anchorRaw = Array.isArray(sp.anchor) ? sp.anchor[0] : sp.anchor;
  const anchor = anchorRaw && isISODate(anchorRaw) ? anchorRaw : null;

  // ✅ Man–Fre for anchor-uken, ellers inneværende uke
  const days = anchor ? weekRangeISOFrom(anchor, 0) : weekRangeISO(0);

  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) redirect("/login?next=/menus/week");

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr || !profile || profile.role !== "superadmin") redirect("/week");

  // ✅ Superadmin: hent ALT (også upublisert)
  const sanityDays = await getMenuForDatesAdmin(days);

  const byDate = new Map<string, SanityMenuDay>();
  for (const m of sanityDays) byDate.set(m.date, m);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ukemeny</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Superadmin (Sanity) – full oversikt, Man–Fre.
          </p>
        </div>

        <div className="text-right text-xs text-[rgb(var(--lp-muted))]">
          <div>Innlogget: {profile.full_name ?? profile.email ?? user.email}</div>
          <div>Rolle: {profile.role}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {days.map((dateISO) => {
          const menu = byDate.get(dateISO);
          const status = computeStatus(menu);

          return (
            <section
              key={dateISO}
              className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium capitalize">
                    {dayNameNO(dateISO)}{" "}
                    <span className="text-[rgb(var(--lp-muted))]">
                      • {prettyDateNO(dateISO)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    {dateISO}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {menu?.tier ? <span className="lp-chip">{menu.tier}</span> : null}
                  {status.chips.map((c) => (
                    <span key={c.label} className={chipClass(c.kind)}>
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {menu ? (
                  <>
                    <h2 className="text-base font-semibold leading-snug">
                      {menu.title?.trim() ? menu.title : "Uten tittel"}
                    </h2>

                    {menu.description?.trim() ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-[rgb(var(--lp-muted))]">
                        {menu.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
                        (Ingen beskrivelse)
                      </p>
                    )}

                    {menu.allergens?.length ? (
                      <div className="mt-4">
                        <div className="text-xs font-medium text-[rgb(var(--lp-muted))]">
                          Allergener
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {menu.allergens.map((a) => (
                            <span key={a} className="lp-chip">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">
                      Doc: <span className="font-mono">{menu._id}</span>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="text-sm font-medium">Ingen meny funnet</div>
                    <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                      Denne datoen mangler i Sanity. Neste steg er “Opprett meny”.
                    </p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
