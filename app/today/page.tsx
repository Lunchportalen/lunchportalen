export const revalidate = 30;

import { osloTodayISODate } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/date/cutoff";
import { getActiveAnnouncement, getMenuForDate } from "@/lib/sanity/queries";
import TodayClient from "./todayClient";

function severityClasses(sev: "info" | "warning" | "critical") {
  if (sev === "critical") return "bg-red-50 border-red-200 text-red-900";
  if (sev === "warning") return "bg-yellow-50 border-yellow-200 text-yellow-900";
  return "bg-blue-50 border-blue-200 text-blue-900";
}

export default async function TodayPage() {
  const today = osloTodayISODate();
  const cutoff = cutoffStatusNow();

  const announcement = await getActiveAnnouncement();
  const menu = await getMenuForDate(today);
  const menuAvailable = Boolean(menu?.isPublished);

  return (
    <main className="p-6">
      {announcement && (
        <div
          className={`mb-4 rounded-xl p-4 border ${severityClasses(
            announcement.severity
          )}`}
        >
          <div className="font-semibold">{announcement.title}</div>
          <div className="mt-1 text-sm">{announcement.message}</div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bestill lunsj</h1>
          <p className="mt-1 text-sm opacity-80">Dato: {today}</p>
        </div>

        <div className="rounded-full px-3 py-1 text-xs border border-white/15">
          {cutoff.isLocked ? "Låst etter 08:00" : "Åpent til 08:00"}
        </div>
      </div>

      <section className="mt-5 rounded-xl border border-white/15 p-4">
        <div className="text-sm opacity-70">Dagens meny</div>

        {menuAvailable ? (
          <>
            <div className="mt-2 font-medium">{menu?.description}</div>
            {menu?.allergens?.length ? (
              <div className="mt-1 text-sm opacity-70">
                Allergener: {menu.allergens.join(", ")}
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-2 text-sm opacity-70">
            Meny er ikke publisert for i dag. Bestilling er derfor ikke tilgjengelig.
          </div>
        )}
      </section>

      <TodayClient
        dateISO={today}
        cutoffLocked={cutoff.isLocked}
        menuAvailable={menuAvailable}
      />
    </main>
  );
}
