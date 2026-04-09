"use client";

import Link from "next/link";

export default function SalesEnginePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Command Center
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Sales Engine</h1>
        <p className="mt-1 text-sm text-slate-600">
          HubSpot-synkronisering er valgfri (<code className="font-mono text-xs">HUBSPOT_SYNC_ENABLED</code>). Utsending
          skjer ikke automatisk.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/pitch"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55"
        >
          Pitch / investor
        </Link>
        <Link
          href="/backoffice/autonomy"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55"
        >
          Anbefalinger
        </Link>
        <Link
          href="/backoffice/control-tower"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55"
        >
          Control Tower
        </Link>
      </div>

      <p className="text-sm text-slate-600">
        AI-generert uttrekk: bruk POST <code className="font-mono text-xs">/api/outbound/generate</code> (kun superadmin)
        med JSON <code className="font-mono text-xs">{"{ company, pain }"}</code>.
      </p>
    </div>
  );
}
