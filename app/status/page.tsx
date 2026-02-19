// app/status/page.tsx
import "server-only";

import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type StatusState =
  | "paused"
  | "closed"
  | "pending"
  | "inactive"
  | "missing_agreement"
  | "hold"
  | "blocked";

type SP = Record<string, string | string[] | undefined>;

function safeState(v: string | null): StatusState {
  const s = String(v ?? "").trim().toLowerCase();

  if (s === "closed") return "closed";
  if (s === "pending") return "pending";
  if (s === "inactive") return "inactive";
  if (s === "missing_agreement" || s === "missing-agreement" || s === "no_contract" || s === "no-contract")
    return "missing_agreement";
  if (s === "hold" || s === "billing_hold" || s === "billing-hold") return "hold";
  if (s === "blocked") return "blocked";
  if (s === "paused") return "paused";

  // default (fail-closed UX): blocked is more accurate than paused
  return "blocked";
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

function normalizePath(p: string | null): string | null {
  if (!p) return null;
  const s = safeDecode(p).trim();
  if (!s) return null;
  if (!s.startsWith("/")) return null;
  if (s.startsWith("//")) return null; // prevent protocol-relative
  if (/[\r\n\t]/.test(s)) return null; // prevent control chars

  // Disallow API jumps
  if (s.startsWith("/api/")) return null;

  // Avoid loops back into auth-flow pages
  if (
    s === "/login" ||
    s.startsWith("/login/") ||
    s === "/register" ||
    s.startsWith("/register/") ||
    s === "/registrering" ||
    s.startsWith("/registrering/") ||
    s === "/forgot-password" ||
    s.startsWith("/forgot-password/") ||
    s === "/reset-password" ||
    s.startsWith("/reset-password/") ||
    s === "/onboarding" ||
    s.startsWith("/onboarding/")
  ) {
    return null;
  }

  // Avoid raw /orders surface (blocked in system)
  if (s === "/orders" || s.startsWith("/orders/")) return null;

  return s;
}

/** Never show /superadmin as next for non-superadmin UX (status page is public). */
function sanitizeNextForDisplay(nextPath: string | null): string | null {
  if (!nextPath) return null;
  if (nextPath.startsWith("/superadmin")) return "/admin";
  return nextPath;
}

function titleForState(state: StatusState) {
  switch (state) {
    case "closed":
      return "Firmaet er stengt";
    case "pending":
      return "Venter på aktivering";
    case "inactive":
      return "Kontoen er ikke aktivert";
    case "missing_agreement":
      return "Mangler aktiv avtale";
    case "hold":
      return "Bestilling er midlertidig låst";
    case "blocked":
      return "Tilgangen er midlertidig blokkert";
    case "paused":
    default:
      return "Firmaet er midlertidig pauset";
  }
}

function messageForState(state: StatusState) {
  switch (state) {
    case "closed":
      return "Tilgangen er stengt på firmanivå. Dersom dette er en feil, må firmaets administrator kontakte oss.";
    case "pending":
      return "Bedriften er registrert med status PENDING. Avtalen må kvalitetssikres og aktiveres før innlogging og bestilling blir tilgjengelig. Du får beskjed på e-post når alt er klart.";
    case "inactive":
      return "Kontoen din er registrert, men er ikke aktivert ennå. Når firmaet er aktivert, åpnes tilgangen automatisk.";
    case "missing_agreement":
      return "Firmaet ditt har ikke en aktiv avtale i systemet ennå. Firma-admin må opprette eller aktivere avtalen før bestilling blir tilgjengelig.";
    case "hold":
      return "Du kan se informasjon, men bestilling og avbestilling er midlertidig sperret for firma. Kontakt firma-admin eller support dersom dette er uventet.";
    case "blocked":
      return "Vi kunne ikke verifisere tilgang akkurat nå. Av sikkerhetsgrunner er tilgangen midlertidig blokkert. Prøv igjen, eller kontakt firmaets administrator/support hvis det vedvarer.";
    case "paused":
    default:
      return "Tilgangen er satt på pause på firmanivå. Firmaets administrator kan reaktivere tilgangen når alt er i orden.";
  }
}

function chipForState(state: StatusState) {
  // Keep conservative visuals (warn for most non-active)
  const cls =
    state === "closed"
      ? "lp-chip lp-chip-neutral"
      : state === "pending" || state === "inactive"
      ? "lp-chip lp-chip-warn"
      : state === "missing_agreement"
      ? "lp-chip lp-chip-warn"
      : state === "hold"
      ? "lp-chip lp-chip-warn"
      : state === "blocked"
      ? "lp-chip lp-chip-warn"
      : "lp-chip lp-chip-warn";

  const label =
    state === "closed"
      ? "Closed"
      : state === "pending"
      ? "Pending"
      : state === "inactive"
      ? "Inactive"
      : state === "missing_agreement"
      ? "No agreement"
      : state === "hold"
      ? "Hold"
      : state === "blocked"
      ? "Blocked"
      : "Paused";

  return { cls, label };
}

function safeNextFallback(nextPath: string | null) {
  // status is public: always keep a sane fallback
  return nextPath ?? "/week";
}

/**
 * Primary CTA:
 * - always go through /api/auth/post-login for authenticated users
 * - if user is not logged in, they’ll be redirected to /login by that route
 * This keeps "one truth-ledd" intact.
 */
function primaryHref(nextPath: string | null) {
  const next = safeNextFallback(nextPath);
  return `/api/auth/post-login?next=${encodeURIComponent(next)}`;
}

export default async function StatusPage({ searchParams }: { searchParams?: SP | Promise<SP> }) {
  const sp = await Promise.resolve(searchParams ?? {});

  const stateRaw = first(sp.state);
  const nextRaw = first(sp.next);
  const ridRaw = first(sp.rid);
  const codeRaw = first(sp.code);
  const reasonRaw = first(sp.reason); // optional debug
  const emailRaw = first(sp.email); // optional debug

  const state = safeState(stateRaw ? safeDecode(stateRaw) : null);

  const nextPathRaw = normalizePath(nextRaw);
  const nextPath = sanitizeNextForDisplay(nextPathRaw);

  const title = titleForState(state);
  const message = messageForState(state);
  const chip = chipForState(state);

  const rid = ridRaw ? safeDecode(ridRaw) : null;
  const code = codeRaw ? safeDecode(codeRaw) : null;
  const reason = reasonRaw ? safeDecode(reasonRaw) : null;
  const email = emailRaw ? safeDecode(emailRaw) : null;

  // ✅ Hard logout path even on public status page.
  // Works with <Link> because GET is supported by /api/auth/logout route.
  const logoutHref = `/api/auth/logout?next=${encodeURIComponent(safeNextFallback(nextPath))}`;

  return (
    <main className="min-h-[100svh] bg-[rgb(var(--lp-bg))]">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <div className="rounded-3xl bg-white/70 p-7 ring-1 ring-[rgb(var(--lp-border))] shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className={chip.cls}>{chip.label}</span>
            <h1 className="text-xl font-semibold tracking-tight text-[rgb(var(--lp-text))] md:text-2xl">{title}</h1>
          </div>

          <p className="mt-3 text-sm leading-6 text-[rgb(var(--lp-muted))]">{message}</p>

          {nextPath ? (
            <div className="mt-4 rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="text-xs font-medium text-[rgb(var(--lp-muted))]">Du forsøkte å gå til:</div>
              <div className="mt-1 break-all text-sm text-[rgb(var(--lp-text))]">{nextPath}</div>
            </div>
          ) : null}

          {reason || email ? (
            <div className="mt-4 rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="text-xs font-medium text-[rgb(var(--lp-muted))]">Detaljer (debug):</div>
              <div className="mt-2 space-y-1 text-xs text-[rgb(var(--lp-muted))]">
                {reason ? (
                  <div>
                    Årsak: <span className="font-mono text-[rgb(var(--lp-text))]">{reason}</span>
                  </div>
                ) : null}
                {email ? (
                  <div>
                    Bruker: <span className="font-mono text-[rgb(var(--lp-text))]">{email}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {code || rid ? (
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
              href={primaryHref(nextPath)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[rgb(var(--lp-text))] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Prøv igjen
            </Link>

            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/70"
            >
              Gå til forsiden
            </Link>

            <Link
              href={logoutHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/70"
            >
              Logg ut
            </Link>
          </div>

          <div className="mt-6 text-xs text-[rgb(var(--lp-muted))]">
            Hvis du mener dette er feil, kontakt firmaets administrator eller support. Ta med <span className="font-mono">RID</span>{" "}
            og <span className="font-mono">Feilkode</span>.
          </div>
        </div>
      </div>
    </main>
  );
}
