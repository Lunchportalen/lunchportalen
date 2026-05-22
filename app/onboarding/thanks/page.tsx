import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { SYSTEM_EMAILS } from "@/lib/system/emails";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function Thanks({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const statusRaw = sp.status;
  const status = safeStr(Array.isArray(statusRaw) ? statusRaw[0] : statusRaw) || "pending";

  return (
    <main className="ds-page ds-empty-state">
      <div className="ds-container">
        <div className="ds-text-limit ds-empty-state__limit">
          <div className="ds-empty-state__panel ds-fade-up">
            <div
              className="ds-empty-state__icon-wrap ds-empty-state__icon-wrap--success"
              aria-hidden="true"
            >
              <CheckCircle2 />
            </div>

            <p className="ds-eyebrow">Fullført</p>

            <h1 className="ds-h2">Takk for registreringen</h1>

            <p className="ds-lead">Bedriften er opprettet. Du er nå logget inn.</p>

            <p className="ds-lead">
              Vi har mottatt forespørselen. Avtalen aktiveres etter gjennomgang. Når avtalen er aktiv kan du legge til
              ansatte.
            </p>

            <div className="ds-empty-state__meta">
              <b>Status:</b> {status}
            </div>

            <div className="ds-empty-state__actions">
              <Link href="/login" className="ds-btn ds-btn--primary">
                Gå til innlogging
              </Link>
              <Link href="/" className="ds-btn ds-btn--secondary">
                Til forsiden
              </Link>
            </div>

            <div className="ds-empty-state__note">
              <p className="ds-empty-state__note-title">Spørsmål eller behov for hjelp?</p>
              <p>
                Har du spørsmål om registreringen eller veien videre, er du hjertelig velkommen til å ta kontakt med oss.
              </p>
              <p>
                📧{" "}
                <a href={`mailto:${SYSTEM_EMAILS.SUPPORT}`}>{SYSTEM_EMAILS.SUPPORT}</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
