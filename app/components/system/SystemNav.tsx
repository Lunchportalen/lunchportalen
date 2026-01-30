// components/system/SystemNav.tsx
import Link from "next/link";
import type { SystemSectionId } from "@/lib/system/types";
import { SYSTEM_SECTIONS, SYSTEM_SECTIONS_ORDER } from "@/lib/system/docs";

export default function SystemNav({ active }: { active: SystemSectionId }) {
  return (
    <aside className="w-full lg:w-72 shrink-0">
      <div className="rounded-2xl border bg-white shadow-sm p-3">
        <div className="px-3 py-2">
          <div className="text-sm font-semibold">System</div>
          <div className="text-xs text-neutral-500">Read-only fasit</div>
        </div>

        <nav className="mt-2 space-y-1">
          {SYSTEM_SECTIONS_ORDER.map((id) => {
            const s = SYSTEM_SECTIONS[id];
            const isActive = id === active;

            return (
              <Link
                key={id}
                href={`/system/${id}`}
                className={[
                  "block rounded-xl px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "hover:bg-neutral-50 text-neutral-800",
                ].join(" ")}
              >
                <div className="font-medium">{s.title}</div>
                {s.subtitle ? <div className="text-xs opacity-80 line-clamp-1">{s.subtitle}</div> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 px-3 py-2 text-xs text-neutral-500">
          Alt innhold her skal speile faktisk systemoppførsel.
        </div>
      </div>
    </aside>
  );
}
