"use client";

export default function ContentDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Content</h1>
      <p className="mt-2 text-sm text-slate-600">
        Velg en node i treet til venstre for å redigere, eller opprett nytt innhold.
      </p>
      <div className="mt-6 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4">
        <h2 className="text-sm font-medium text-slate-800">Områder</h2>
        <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
          <li>Home – rotnivå</li>
          <li>Global – header, footer m.m.</li>
          <li>Design – design tokens</li>
          <li>Recycle Bin – slettet innhold</li>
        </ul>
      </div>
    </div>
  );
}
