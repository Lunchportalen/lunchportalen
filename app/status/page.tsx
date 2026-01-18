// app/status/page.tsx
import Link from "next/link";

export const revalidate = 0;

type StatusState = "paused" | "closed";

function safeState(v: string | null): StatusState {
  return v === "closed" ? "closed" : "paused";
}

export default function StatusPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = searchParams ?? {};
  const stateRaw = Array.isArray(sp.state) ? sp.state[0] : sp.state;
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next;

  const state = safeState(stateRaw ?? null);

  // Vi viser "hvor de prøvde å gå" bare som støtteinfo, ikke som CTA
  const nextPath =
    typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : null;

  const title =
    state === "closed" ? "Firmaet er stengt" : "Firmaet er midlertidig pauset";

  const message =
    state === "closed"
      ? "Tilgangen er stengt på firmanivå. Dersom dette er en feil, må firmaets administrator kontakte oss."
      : "Tilgangen er satt på pause på firmanivå. Firmaets administrator kan reaktivere tilgangen når alt er i orden.";

  const chip =
    state === "closed"
      ? "lp-chip lp-chip-neutral"
      : "lp-chip lp-chip-warn";

  return (
    <main className="min-h-[100svh] bg-[rgb(var(--lp-bg))]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <div className="rounded-3xl bg-white/70 p-7 ring-1 ring-[rgb(var(--lp-border))] shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className={chip}>
              {state === "closed" ? "Closed" : "Paused"}
            </span>
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-[rgb(var(--lp-text))] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Til innlogging
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/70"
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
