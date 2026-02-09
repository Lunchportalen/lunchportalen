// app/status/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatusState = "paused" | "closed" | "pending" | "inactive";

function safeState(v: string | null): StatusState {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "closed") return "closed";
  if (s === "pending") return "pending";
  if (s === "inactive") return "inactive";
  return "paused";
}

function first(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default function StatusPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = searchParams ?? {};
  const stateRaw = first(sp.state);
  const nextRaw = first(sp.next);
  const ridRaw = first(sp.rid);
  const codeRaw = first(sp.code);

  const state = safeState(stateRaw ? safeDecode(stateRaw) : null);

  // Vi viser "hvor de prøvde å gå" bare som støtteinfo, ikke som CTA
  const nextPath =
    typeof nextRaw === "string" &&
    safeDecode(nextRaw).startsWith("/") &&
    !safeDecode(nextRaw).startsWith("//")
      ? safeDecode(nextRaw)
      : null;

  const title =
    state === "closed"
      ? "Firmaet er stengt"
      : state === "pending"
      ? "Venter på aktivering"
      : state === "inactive"
      ? "Kontoen er ikke aktivert"
      : "Firmaet er midlertidig pauset";

  const message =
    state === "closed"
      ? "Tilgangen er stengt på firmanivå. Dersom dette er en feil, må firmaets administrator kontakte oss."
      : state === "pending"
      ? "Bedriften er registrert med status PENDING. Avtalen må kvalitetssikres og aktiveres før innlogging og bestilling blir tilgjengelig. Du får beskjed på e-post når alt er klart."
      : state === "inactive"
      ? "Kontoen din er registrert, men er ikke aktivert ennå. Når firmaet er aktivert, åpnes tilgangen automatisk."
      : "Tilgangen er satt på pause på firmanivå. Firmaets administrator kan reaktivere tilgangen når alt er i orden.";

  const chip =
    state === "closed"
      ? "lp-chip lp-chip-neutral"
      : state === "pending" || state === "inactive"
      ? "lp-chip lp-chip-warn"
      : "lp-chip lp-chip-warn";

  const chipLabel =
    state === "closed"
      ? "Closed"
      : state === "pending"
      ? "Pending"
      : state === "inactive"
      ? "Inactive"
      : "Paused";

  const rid = ridRaw ? safeDecode(ridRaw) : null;
  const code = codeRaw ? safeDecode(codeRaw) : null;

  return (
    <main className="min-h-[100svh] bg-[rgb(var(--lp-bg))]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <div className="rounded-3xl bg-white/70 p-7 ring-1 ring-[rgb(var(--lp-border))] shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className={chip}>{chipLabel}</span>
            <h1 className="text-xl font-semibold tracking-tight text-[rgb(var(--lp-text))] md:text-2xl">
              {title}
            </h1>
          </div>

          <p className="mt-3 text-sm leading-6 text-[rgb(var(--lp-muted))]">
            {message}
          </p>

          {nextPath ? (
            <div className="mt-4 rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="text-xs font-medium text-[rgb(var(--lp-muted))]">
                Du forsøkte å gå til:
              </div>
              <div className="mt-1 break-all text-sm text-[rgb(var(--lp-text))]">
                {nextPath}
              </div>
            </div>
          ) : null}

          {(code || rid) ? (
            <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">
              {code ? (
                <span>
                  Feilkode: <span className="font-mono">{code}</span>
                </span>
              ) : null}
              {code && rid ? <span className="mx-2">•</span> : null}
              {rid ? (
                <span>
                  Ref: <span className="font-mono">{rid}</span>
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[rgb(var(--lp-text))] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Til innlogging
            </Link>

            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/70"
            >
              Gå til forsiden
            </Link>
          </div>

          <div className="mt-6 text-xs text-[rgb(var(--lp-muted))]">
            Hvis du mener dette er feil, kontakt firmaets administrator eller
            support.
          </div>
        </div>
      </div>
    </main>
  );
}
