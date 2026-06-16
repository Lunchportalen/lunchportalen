"use client";

import {
  SuperadminEmptyState,
  SuperadminHero,
  SuperadminPageShell,
  SuperadminSection,
} from "@/components/superadmin/shell/SuperadminShell";

export default function OperationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ref = error.digest ? error.digest.slice(0, 8) : null;

  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title="Operasjoner"
        lead="Dagens leveranser kunne ikke lastes akkurat nå."
      />

      <SuperadminSection title="Begrenset visning" flat>
        <SuperadminEmptyState>
          <p className="font-medium text-[rgb(var(--lp-text))]">Leveransedata er midlertidig utilgjengelig</p>
          <p className="mt-2 max-w-lg mx-auto text-sm">
            Dette er en read-only oversikt. Siden endrer ikke produksjon eller ordre — prøv igjen om litt, eller bruk
            systemhelse for driftssjekk.
          </p>
          {ref ? <p className="mt-2 font-mono text-xs">Ref: {ref}</p> : null}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
          >
            Prøv igjen
          </button>
        </SuperadminEmptyState>
      </SuperadminSection>
    </SuperadminPageShell>
  );
}
