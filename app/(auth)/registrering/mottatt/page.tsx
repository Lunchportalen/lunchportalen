import Link from "next/link";
import { MailCheck } from "lucide-react";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function RegistrationReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const companyIdRaw = sp.companyId;
  const companyId = safeStr(Array.isArray(companyIdRaw) ? companyIdRaw[0] : companyIdRaw);

  return (
    <main className="ds-page ds-empty-state">
      <div className="ds-container">
        <div className="ds-text-limit ds-empty-state__limit">
          <div className="ds-empty-state__panel ds-fade-up">
            <div
              className="ds-empty-state__icon-wrap ds-empty-state__icon-wrap--success"
              aria-hidden="true"
            >
              <MailCheck />
            </div>

            <p className="ds-eyebrow">Mottatt</p>

            <h1 className="ds-h2">Registreringen er mottatt</h1>

            <p className="ds-lead">Vi tar kontakt så snart alt er klart.</p>

            {companyId ? (
              <div className="ds-empty-state__meta">
                Referanse: <span className="ds-empty-state__mono">{companyId}</span>
              </div>
            ) : null}

            <div className="ds-empty-state__actions">
              <Link href="/" className="ds-btn ds-btn--primary">
                Til forsiden
              </Link>
              <Link href="/login" className="ds-btn ds-btn--secondary">
                Til innlogging
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
