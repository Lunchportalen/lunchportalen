"use client";

export default function RecycleBinPlaceholder() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Recycle Bin</h1>
      <p className="mt-2 text-sm text-slate-600">Slettet innhold vises her.</p>
      <ul className="mt-4 list-inside list-disc text-sm text-slate-600">
        <li>Ingen elementer i papirkurven (lokal mock).</li>
      </ul>
    </div>
  );
}
