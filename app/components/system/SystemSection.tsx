// components/system/SystemSection.tsx
import type { Role, SystemSection } from "@/lib/system/types";
import { isVisibleForRole } from "@/lib/system/docs";

export default function SystemSectionView({ section, role }: { section: SystemSection; role: Role }) {
  return (
    <div className="space-y-4">
      <header className="rounded-2xl border bg-white shadow-sm p-6">
        <div className="text-xs text-neutral-500">/system/{section.id}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{section.title}</h1>
        {section.subtitle ? <p className="mt-2 text-neutral-600">{section.subtitle}</p> : null}

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
          <span className="font-medium">Rolle:</span> <span>{role}</span>
        </div>
      </header>

      <div className="space-y-4">
        {section.blocks
          .filter((b) => isVisibleForRole(b.visibility?.roles, role))
          .map((b, idx) => (
            <section key={`${section.id}-${idx}`} className="rounded-2xl border bg-white shadow-sm p-6">
              <h2 className="text-lg font-semibold">{b.title}</h2>
              <div className="mt-3 space-y-3 text-neutral-700 leading-relaxed">
                {b.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
