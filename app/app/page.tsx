import { osloTodayISO } from "@/lib/date/oslo";
import { weekRangeISO } from "@/lib/date/week";
import {
  getActiveAnnouncement,
  getMenuForDate,
  getMenuForDates,
  type Announcement,
  type MenuContent,
} from "@/lib/sanity/queries";

function severityClasses(sev: Announcement["severity"]) {
  if (sev === "critical") return "bg-red-50 border-red-200 text-red-900";
  if (sev === "warning") return "bg-yellow-50 border-yellow-200 text-yellow-900";
  return "bg-blue-50 border-blue-200 text-blue-900";
}

export default async function Page() {
  const today = osloTodayISO();

  const announcement = await getActiveAnnouncement();

  const todayMenu = await getMenuForDate(today);
  const todayPublished = Boolean(todayMenu?.isPublished);

  const thisWeekDates = weekRangeISO(0);
  const nextWeekDates = weekRangeISO(1);

  const thisWeekMenuRaw = await getMenuForDates(thisWeekDates);
  const nextWeekMenuRaw = await getMenuForDates(nextWeekDates);

  // Type-safe filter (gir MenuContent[])
  const thisWeekMenu: MenuContent[] = thisWeekMenuRaw.filter((m) => m.isPublished === true);
  const nextWeekMenu: MenuContent[] = nextWeekMenuRaw.filter((m) => m.isPublished === true);

  return (
    <main className="p-6">
      {announcement && (
        <div className={`mb-6 rounded-xl p-4 border ${severityClasses(announcement.severity)}`}>
          <div className="font-semibold">{announcement.title}</div>
          <div className="mt-1 text-sm">{announcement.message}</div>
        </div>
      )}

      <h1 className="text-2xl font-bold">Lunsjportalen</h1>
      <p className="mt-2 text-sm opacity-80">
        Portalen kjører – neste steg er innlogging og bestilling.
      </p>

      {/* Dagens meny */}
      <section className="mt-6 rounded-xl border border-white/15 p-4">
        <div className="text-sm opacity-70">Dagens meny ({today})</div>

        {todayPublished ? (
          <>
            <div className="mt-2 font-medium">{todayMenu?.description || "—"}</div>
            {todayMenu?.allergens?.length ? (
              <div className="mt-1 text-sm opacity-70">
                Allergener: {todayMenu.allergens.join(", ")}
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-2 text-sm opacity-70">Meny er ikke publisert for i dag.</div>
        )}
      </section>

      {/* Denne uken */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Denne uken</h2>

        {thisWeekMenu.length ? (
          <div className="mt-3 grid gap-2">
            {thisWeekMenu.map((m) => (
              <div key={m._id} className="rounded-xl border border-white/15 p-3">
                <div className="text-sm opacity-70">{m.date}</div>
                <div className="mt-1 font-medium">{m.description || "—"}</div>
                {m.allergens?.length ? (
                  <div className="mt-1 text-sm opacity-70">
                    Allergener: {m.allergens.join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm opacity-70">Meny ikke publisert for denne uken.</div>
        )}
      </section>

      {/* Neste uke */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Neste uke</h2>

        {nextWeekMenu.length ? (
          <div className="mt-3 grid gap-2">
            {nextWeekMenu.map((m) => (
              <div key={m._id} className="rounded-xl border border-white/15 p-3">
                <div className="text-sm opacity-70">{m.date}</div>
                <div className="mt-1 font-medium">{m.description || "—"}</div>
                {m.allergens?.length ? (
                  <div className="mt-1 text-sm opacity-70">
                    Allergener: {m.allergens.join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm opacity-70">Neste ukes meny publiseres på torsdag.</div>
        )}
      </section>
    </main>
  );
}
