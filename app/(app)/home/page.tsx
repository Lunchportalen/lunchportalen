// app/(app)/home/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";

import { osloTodayISODate } from "@/lib/date/oslo";
import { weekRangeISO } from "@/lib/date/week";
import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";
import {
  getActiveAnnouncement,
  getMenuForDate,
  getMenuForDates,
  type Announcement,
  type MenuContent,
} from "@/lib/cms/menuContent";

function severityCard(sev: Announcement["severity"]) {
  if (sev === "critical") return "bg-red-50 border-red-200 text-red-900";
  if (sev === "warning") return "bg-yellow-50 border-yellow-200 text-yellow-900";
  return "bg-blue-50 border-blue-200 text-blue-900";
}

function severityChip(sev: Announcement["severity"]) {
  if (sev === "critical") return "lp-chip lp-chip-crit";
  if (sev === "warning") return "lp-chip lp-chip-warn";
  return "lp-chip";
}

function dayNameNO(dateISO: string) {
  const full = formatWeekdayNO(dateISO);
  if (!full) return "";
  return full.charAt(0).toUpperCase() + full.slice(1, 3);
}

// YYYY-MM-DD kan sammenlignes som string
function relToToday(dateISO: string, todayISO: string) {
  if (dateISO === todayISO) return 0;
  return dateISO < todayISO ? -1 : 1;
}

function StatusChip({ m, todayISO }: { m: MenuContent; todayISO: string }) {
  const rel = relToToday(m.date, todayISO);
  if (rel < 0) return <span className="lp-chip">Gjennomført</span>;
  if (m.isPublished) return <span className="lp-chip lp-chip-ok">Klar</span>;
  return <span className="lp-chip">Ikke klar</span>;
}

function WeekListRow({ m, todayISO }: { m: MenuContent; todayISO: string }) {
  const rel = relToToday(m.date, todayISO);

  return (
    <div className="lp-weekRow">
      <div>
        <div className="lp-weekDate">
          {dayNameNO(m.date)} • {formatDateNO(m.date)}
        </div>
      </div>

      <div>
        <div className={["lp-weekTitle", rel < 0 ? "opacity-70" : ""].join(" ")}>
          {m.description || "—"}
        </div>
        <div className={["lp-weekSub", rel < 0 ? "opacity-70" : ""].join(" ")}>
          Allergener: {m.allergens?.length ? m.allergens.join(", ") : "ingen"}
        </div>
      </div>

      <StatusChip m={m} todayISO={todayISO} />
    </div>
  );
}

export default async function Page() {
  // ✅ AUTH GATE
  const sb = await supabaseServer();

  let user: any = null;
  try {
    const { data } = await sb.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login?next=/home");
  }

  // ✅ DATA
  const today = osloTodayISODate();
  const thisWeekDates = weekRangeISO(0);
  const nextWeekDates = weekRangeISO(1);

  let announcement: Announcement | null = null;
  let todayMenu: MenuContent | null = null;
  let thisWeekMenuRaw: MenuContent[] = [];
  let nextWeekMenuRaw: MenuContent[] = [];

  try {
    const [a, t, w0, w1] = await Promise.all([
      getActiveAnnouncement(),
      getMenuForDate(today),
      getMenuForDates(thisWeekDates),
      getMenuForDates(nextWeekDates),
    ]);

    announcement = a;
    todayMenu = t;
    thisWeekMenuRaw = w0;
    nextWeekMenuRaw = w1;
  } catch {
    // Silent fail -> fallback under
  }

  const todayPublished = Boolean(todayMenu?.isPublished);

  const thisWeekMenu: MenuContent[] = (thisWeekMenuRaw || []).filter(
    (m) => m.isPublished === true
  );
  const nextWeekMenu: MenuContent[] = (nextWeekMenuRaw || []).filter(
    (m) => m.isPublished === true
  );

  const sanityOk = Boolean(
    (thisWeekMenuRaw && thisWeekMenuRaw.length) ||
      (nextWeekMenuRaw && nextWeekMenuRaw.length) ||
      todayMenu ||
      announcement
  );

  return (
    <main className="lp-container">
      {!sanityOk && (
        <div className="lp-card mb-6 border border-yellow-200 bg-yellow-50 p-5 text-yellow-900">
          <div className="text-sm font-semibold">Menydata er midlertidig utilgjengelig</div>
          <div className="mt-1 text-sm opacity-90">
            Vi får ikke kontakt med meny-systemet akkurat nå. Prøv igjen om litt.
          </div>
        </div>
      )}

      {announcement && (
        <div className={`lp-card mb-6 p-5 ${severityCard(announcement.severity)}`}>
          <div className="lp-row items-start">
            <div>
              <div className="text-sm font-semibold">{announcement.title}</div>
              <div className="mt-1 text-sm opacity-90">{announcement.message}</div>
            </div>
            <span className={severityChip(announcement.severity)}>
              {announcement.severity === "critical"
                ? "Kritisk"
                : announcement.severity === "warning"
                ? "Varsel"
                : "Info"}
            </span>
          </div>
        </div>
      )}

      <header className="mb-10">
        <section className="lp-heroImage">
          <div className="lp-heroContent">
            <div className="max-w-xl">
              <h1 className="lp-h1">Lunsjportalen</h1>
              <p className="mt-3 text-base lp-muted">
                Profesjonell firmalunsj – enkelt, forutsigbart og klart innen kl. 08:00.
              </p>

              <div className="mt-6">
                <Link href="/week" className="lp-btn-primary">
                  Gå til ukeplan
                </Link>
              </div>
            </div>
          </div>
        </section>
      </header>

      <section className="lp-card lp-card-pad lp-heroStripe lp-overlap">
        <div className="lp-row items-start">
          <div className="pl-3">
            <h2 className="lp-h2">I dag</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="lp-chip">{dayNameNO(today)}</span>
              <span className="lp-chip">{formatDateNO(today)}</span>
              <span className="lp-chip">Cut-off 08:00</span>
              <span className="lp-chip">Man–Fre</span>
            </div>
          </div>

          <span className={todayPublished ? "lp-chip lp-chip-ok" : "lp-chip"}>
            {todayPublished ? "Klar" : "Ikke klar"}
          </span>
        </div>

        <div className="mt-5 lp-divider" />

        {todayPublished ? (
          <div className="mt-5 pl-3">
            <div className="text-2xl font-semibold text-[rgb(var(--lp-fg))]">
              {todayMenu?.description || "—"}
            </div>

            <p className="mt-1 text-sm lp-muted">Oversikt fra ukemenyen.</p>

            <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
              Allergener:{" "}
              {todayMenu?.allergens?.length ? todayMenu.allergens.join(", ") : "ingen"}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/week" className="lp-btn">
                Gå til ukeplan
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 pl-3 text-sm text-[rgb(var(--lp-muted))]">
            Meny er ikke publisert for i dag.
            <div className="mt-4">
              <Link href="/week" className="lp-btn">
                Se ukeplan
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="lp-sectionTitle">Denne uken</h2>
            <div className="mt-2 lp-listMeta">Man–Fre</div>
          </div>
          <span className="lp-chip">{thisWeekMenu.length} dager</span>
        </div>

        <div className="mt-4">
          {thisWeekMenu.length ? (
            <div className="lp-softDivider">
              {thisWeekMenu.map((m, idx) => (
                <div key={m._id} className={idx === 0 ? "" : "lp-softDivider"}>
                  <WeekListRow m={m} todayISO={today} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Meny ikke publisert for denne uken.</div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="lp-sectionTitle">Neste uke</h2>
            <div className="mt-2 lp-listMeta">Man–Fre</div>
          </div>
          <span className="lp-chip">{nextWeekMenu.length} dager</span>
        </div>

        <div className="mt-4">
          {nextWeekMenu.length ? (
            <div className="lp-softDivider">
              {nextWeekMenu.map((m, idx) => (
                <div key={m._id} className={idx === 0 ? "" : "lp-softDivider"}>
                  <WeekListRow m={m} todayISO={today} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Neste ukes meny publiseres på torsdag.</div>
          )}
        </div>

        <div className="mt-6">
          <Link href="/week" className="lp-btn">
            Åpne ukeplan
          </Link>
        </div>
      </section>
    </main>
  );
}






