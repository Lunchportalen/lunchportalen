"use client";

import { Card } from "@/components/ui/card";

export default function ContentDashboard() {
  return (
    <div className="min-h-0 bg-gradient-to-b from-white to-slate-50/80 p-6 lg:p-8">
      <div className="max-w-5xl space-y-6">
        <header className="border-b border-slate-200/90 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Content section</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Content</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Tree-first arbeidsflate for sider, globale noder og designnære reserveruter. Velg en node til venstre for å
            åpne editoren, historikk eller preview.
          </p>
        </header>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card variant="soft" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Primær navigasjon</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">Content tree</p>
            <p className="mt-2 text-sm text-slate-600">Tree til venstre er hovedinngangen til sider, rotnoder og reservevisninger.</p>
          </Card>
          <Card variant="soft" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Arbeidsflate</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">Editor, preview og inspector</p>
            <p className="mt-2 text-sm text-slate-600">Når en side velges åpnes editoren i en egen arbeidsflate med tydeligere sekundærpreview.</p>
          </Card>
          <Card variant="soft" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Driftsærlighet</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">Degradert visning vises eksplisitt</p>
            <p className="mt-2 text-sm text-slate-600">Schema-feil i tree og audit skal varsles ærlig i stedet for å skjules bak tomme flater.</p>
          </Card>
        </section>

        <Card variant="soft" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Områder</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <li>Home – rotnivå og forsidekobling</li>
            <li>Global – header, footer og delte flater</li>
            <li>Design – design tokens og sidevisning</li>
            <li>Recycle Bin – slettet innhold</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
