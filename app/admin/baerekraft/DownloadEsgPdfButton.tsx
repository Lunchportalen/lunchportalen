// app/admin/baerekraft/DownloadEsgPdfButton.tsx
"use client";

import { useState } from "react";

export default function DownloadEsgPdfButton() {
  const [busy, setBusy] = useState(false);

  const download = () => {
    if (busy) return;

    try {
      setBusy(true);

      // Årsrapport (default)
      // Kan utvides senere med: ?mode=month&month=YYYY-MM-01
      const url = "/api/admin/esg/report/pdf?mode=year";

      // Bruk browserens native download (attachment)
      window.location.href = url;
    } finally {
      // Liten timeout for å unngå flicker dersom browser er rask
      setTimeout(() => setBusy(false), 1200);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="
        inline-flex items-center gap-2
        rounded-xl bg-white px-4 py-2
        text-sm font-extrabold
        ring-1 ring-[rgb(var(--lp-border))]
        transition hover:bg-white/80
        disabled:cursor-not-allowed disabled:opacity-60
      "
    >
      {busy ? "Laster…" : "Last ned PDF"}
    </button>
  );
}
