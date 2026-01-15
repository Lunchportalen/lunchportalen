import { osloTodayISODate } from "@/lib/date/oslo";
import { weekRangeISO } from "@/lib/date/week";
import {
  getActiveAnnouncement,
  getMenuForDate,
  getMenuForDates,
  type Announcement,
  type MenuContent,
} from "@/lib/sanity/queries";

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
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  const names = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"] as const;
  return names[d.getDay()];
}

function WeekListRow({ m }: { m: MenuContent }) {
  return (
    <div className="lp-weekRow">
      <div>
        <div className="lp-weekDate">
          {dayNameNO(m.date)} • {m.date}
        </div>
      </div>

      <div>
        <div className="lp-weekTitle">{m.description || "—"}</div>
        <div className="lp-weekSub">
          Allergener: {m.allergens?.length ? m.allergens.join(", ") : "ingen"}
        </div>
      </div>

      <span className="lp-chip lp-chip-ok">Publisert</span>
    </div>
  );
}

export default async function Page() {
  const today = osloTodayISODate();

  const announcement = await getActiveAnnouncement();

  const todayMenu = await getMenuForDate(today);
  const todayPublished = Boolean(todayMenu?.isPublished);

  const thisWeekDates = weekRangeISO(0);
  const nextWeekDates = weekRangeISO(1);

  const thisWeekMenuRaw = await getMenuForDates(thisWeekDates);
  const nextWeekMenuRaw = await getMenuForDates(nextWeekDates);

  const thisWeekMenu: MenuContent[] = thisWeekMenuRaw.filter((m) => m.isPublished === true);
  const nextWeekMenu: MenuContent[] = nextWeekMenuRaw.filter((m) => m.isPublished === true);

  return (
    <main className="lp-container">
      {/* Announcement (kun når det finnes) */}
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

      {/* HERO – bilde + tittel + én CTA (null støy) */}
      <header className="mb-10">
        <section className="lp-heroImage">
          <div className="lp-heroContent">
            <div className="max-w-xl">
              <h1 className="lp-h1">Lunsjportalen</h1>
              <p className="mt-3 text-base lp-muted">
                Profesjonell firmalunsj – enkelt, forutsigbart og klart innen kl. 08:00.
              </p>

              <div className="mt-6">
                <a href="/today" className="lp-btn-primary">
                  Gå til dagens meny
                </a>
              </div>
            </div>
          </div>
        </section>
      </header>

      {/* DAGENS MENY – eneste tydelige “card” + overlap */}
      <section className="lp-card lp-card-pad lp-heroStripe lp-overlap">
        <div className="lp-row items-start">
          <div className="pl-3">
            <h2 className="lp-h2">Dagens meny</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="lp-chip">{dayNameNO(today)}</span>
              <span className="lp-chip">{today}</span>
              <span className="lp-chip">Cut-off 08:00</span>
              <span className="lp-chip">Man–Fre</span>
            </div>
          </div>

          <span className={todayPublished ? "lp-chip lp-chip-ok" : "lp-chip"}>
            {todayPublished ? "Publisert" : "Ikke publisert"}
          </span>
        </div>

        <div className="mt-5 lp-divider" />

        {todayPublished ? (
          <div className="mt-5 pl-3">
            <div className="text-2xl font-semibold text-zinc-900">
              {todayMenu?.description || "—"}
            </div>

            <p className="mt-1 text-sm lp-muted">Serveres varm og fersk i dag.</p>

            <div className="mt-2 text-sm text-zinc-600">
              Allergener:{" "}
              {todayMenu?.allergens?.length ? todayMenu.allergens.join(", ") : "ingen"}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <a href="/today" className="lp-btn-primary">
                Gå til bestilling
              </a>
              <a href="/week" className="lp-btn">
                Se ukemeny
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-5 pl-3 text-sm text-zinc-600">
            Meny er ikke publisert for i dag.
          </div>
        )}
      </section>

      {/* UKEOVERSIKT – premium list rhythm */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="lp-sectionTitle">Denne uken</h2>
            <div className="mt-2 lp-listMeta">Publiserte dager (Man–Fre)</div>
          </div>
          <span className="lp-chip">{thisWeekMenu.length} dager</span>
        </div>

        <div className="mt-4">
          {thisWeekMenu.length ? (
            <div className="lp-softDivider">
              {thisWeekMenu.map((m, idx) => (
                <div key={m._id} className={idx === 0 ? "" : "lp-softDivider"}>
                  <WeekListRow m={m} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-600">Meny ikke publisert for denne uken.</div>
          )}
        </div>
      </section>

      {/* NESTE UKE */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="lp-sectionTitle">Neste uke</h2>
            <div className="mt-2 lp-listMeta">Publiserte dager (Man–Fre)</div>
          </div>
          <span className="lp-chip">{nextWeekMenu.length} dager</span>
        </div>

        <div className="mt-4">
          {nextWeekMenu.length ? (
            <div className="lp-softDivider">
              {nextWeekMenu.map((m, idx) => (
                <div key={m._id} className={idx === 0 ? "" : "lp-softDivider"}>
                  <WeekListRow m={m} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-600">Neste ukes meny publiseres på torsdag.</div>
          )}
        </div>
      </section>
    </main>
  );
}
