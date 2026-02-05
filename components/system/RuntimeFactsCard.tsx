// components/system/RuntimeFactsCard.tsx
import type { RuntimeFacts } from "@/lib/system/runtimeFacts";

function safe(v: unknown): string {
  return String(v ?? "").trim() || "—";
}

export default function RuntimeFactsCard({ facts }: { facts: RuntimeFacts }) {
  const rows: Array<[string, string]> = [
    ["Timezone", safe(facts.timezone)],
    ["Cut-off", `${safe(facts.cutoffTimeLocal)} (${safe(facts.timezone)})`],
    ["Helg", safe(facts.weekendOrdering)],
    ["Order-backup e-post", safe(facts.orderBackupEmail)],
    ["SMTP host", safe(facts.smtpHost)],
    ["SMTP porter", safe(facts.smtpPorts)],
    ["IMAP host", safe(facts.imapHost)],
    ["IMAP port", safe(facts.imapPort)],
  ];

  return (
    <section className="rounded-2xl border bg-white shadow-sm p-6">
      <header>
        <h2 className="text-lg font-semibold">Driftsfakta (runtime)</h2>
        <p className="mt-2 text-neutral-600">
          Dette er aktive verdier hentet fra konfigurasjon/runtime. Mangler her skal feile tydelig.
        </p>
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t first:border-t-0">
                <td className="w-56 px-4 py-3 text-neutral-500">{k}</td>
                <td className="px-4 py-3 font-medium text-neutral-800">
                  <span className="font-mono">{v}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Verdiene over brukes av systemet slik det kjører nå. Endringer krever deploy/restart.
      </div>
    </section>
  );
}
