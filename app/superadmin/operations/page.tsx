// app/superadmin/operations/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 15;

import OperationsToday from "@/components/superadmin/OperationsToday";
import {
  SuperadminHero,
  SuperadminPageShell,
  SuperadminSection,
} from "@/components/superadmin/shell/SuperadminShell";

export default function OperationsPage() {
  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title="Operasjoner"
        lead="Dagens leveranser og produksjonsoversikt — read-only system truth fra deliveries."
      />

      <SuperadminSection title="Dagens leveranser" lead="Gruppert etter firma, lokasjon og vindu." flat>
        <OperationsToday />
      </SuperadminSection>
    </SuperadminPageShell>
  );
}
