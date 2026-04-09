// app/superadmin/growth/social/page.tsx — AI Social Engine (superadmin)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAuthContext } from "@/lib/auth/getAuthContext";

import SocialEngineClient from "./SocialEngineClient";

export default async function SocialEnginePage() {
  const auth = await getAuthContext();

  if (!auth.ok || auth.role !== "superadmin") {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
        <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen tilgang</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <div style={{ padding: 24 }}>
        <h1 className="font-heading text-2xl font-semibold text-[rgb(var(--lp-fg))]">AI Social Engine</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Innhold, kalender, planlegger og læring — trygg modus uten ekstern publisering.           Panelet under har «Forsterkning», «AI Video Studio» (struktur, undertekster, stemme, adapter), «Autonomi» (policy, aggressivitet, maks handlinger,
          prognose-filter) og «Siste handlinger» med tilbakestilling der det er mulig. Inntekt vises kun der den er eksplisitt
          registrert (performance + sporbar ordreattributjon); ingen syntetisk ROI.
        </p>
      </div>
      <SocialEngineClient />
    </main>
  );
}
