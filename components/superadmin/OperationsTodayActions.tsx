// components/superadmin/OperationsTodayActions.tsx
"use client";

export type OperationsCsvDelivery = {
  dato: string;
  firma: string;
  lokasjon: string;
  vindu: string;
  porsjoner: number;
  forecast: string;
  waste: string;
  notater: string;
};

export default function OperationsTodayActions({
  dateISO,
  deliveries,
}: {
  dateISO: string;
  deliveries: OperationsCsvDelivery[];
}) {
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

  function csvEscape(value: string | number) {
    // CSV trygghet: hvis komma/anførsel/linjeskift => wrap i "..."
    const v = String(value ?? "");
    if (/[",\n\r]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
    return v;
  }

  function toCSV() {
    const lines = ["dato,firma,lokasjon,vindu,porsjoner,forecast,waste,notater"];

    for (const delivery of deliveries) {
      lines.push([
        csvEscape(delivery.dato),
        csvEscape(delivery.firma),
        csvEscape(delivery.lokasjon),
        csvEscape(delivery.vindu),
        csvEscape(delivery.porsjoner),
        csvEscape(delivery.forecast),
        csvEscape(delivery.waste),
        csvEscape(delivery.notater),
      ].join(","));
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
