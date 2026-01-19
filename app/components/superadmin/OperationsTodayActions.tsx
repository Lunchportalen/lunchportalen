// components/superadmin/OperationsTodayActions.tsx
"use client";

export default function OperationsTodayActions({ dateISO }: { dateISO: string }) {
  function download(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value: string) {
    // CSV trygghet: hvis komma/anførsel/linjeskift => wrap i "..."
    const v = String(value ?? "");
    if (/[",\n\r]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
    return v;
  }

  function toCSV() {
    // Leser fra DOM for å unngå duplisert datafetch (robust for MVP)
    const cards = Array.from(document.querySelectorAll("[data-delivery-row]")) as HTMLElement[];
    const lines = ["date,company,location,window,portions,notes"];

    for (const el of cards) {
      const date = el.dataset.date ?? "";
      const company = el.dataset.company ?? "";
      const location = el.dataset.location ?? "";
      const windowLabel = el.dataset.window ?? "";
      const portions = el.dataset.portions ?? "0";
      const notes = el.dataset.notes ?? "";

      lines.push(
        [
          csvEscape(date),
          csvEscape(company),
          csvEscape(location),
          csvEscape(windowLabel),
          csvEscape(portions),
          csvEscape(notes),
        ].join(",")
      );
    }

    download(`deliveries_${dateISO}.csv`, lines.join("\n"));
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="rounded-xl border bg-white px-3 py-2 text-sm font-medium hover:bg-bg"
        onClick={printPage}
      >
        Skriv ut
      </button>

      <button
        type="button"
        className="rounded-xl border bg-white px-3 py-2 text-sm font-medium hover:bg-bg"
        onClick={toCSV}
      >
        Eksport CSV
      </button>
    </div>
  );
}
