// app/registrering/employee/register-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ResolveOk = { ok: true; company: { id: string; name: string; status?: string } };
type ResolveErr = { ok: false; error: string; message?: string; detail?: any };

type JoinOk = { ok: true; user_id: string; company_id: string; role: "employee" };
type JoinErr = { ok: false; error: string; message?: string; detail?: any };

function pickMessage(x: any, fallback: string) {
  return String(x?.message || x?.detail?.message || x?.error || fallback);
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function EmployeeRegisterClient({ invite }: { invite: string }) {
  const router = useRouter();

  // resolve state
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // confirm (obligatorisk)
  const [confirm, setConfirm] = useState(false);

  // submit state
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSubmit = useMemo(() => {
    if (!invite) return false;
    if (loading) return false;
    if (resolveError) return false;
    if (!companyName) return false;

    if (name.trim().length < 2) return false;
    if (!isEmail(emailNorm)) return false;
    if (password.length < 8) return false;
    if (!confirm) return false;
    if (posting) return false;

    return true;
  }, [invite, loading, resolveError, companyName, name, emailNorm, password, confirm, posting]);

  // Resolve invite → show locked company
  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setResolveError(null);
      setCompanyName(null);
      setCompanyStatus(null);

      if (!invite) {
        setLoading(false);
        setResolveError("Mangler invitasjonslenke. Be firma-admin om invitasjonslenke, eller gå til innlogging.");
        return;
      }

      try {
        const res = await fetch(`/api/invite/resolve?code=${encodeURIComponent(invite)}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json().catch(() => null)) as (ResolveOk | ResolveErr | null);

        if (!alive) return;

        if (!res.ok || !json || (json as any).ok === false) {
          setResolveError(pickMessage(json, "Kunne ikke validere invitasjonslenken."));
          setLoading(false);
          return;
        }

        const ok = json as ResolveOk;
        setCompanyName(ok.company.name);
        setCompanyStatus(String(ok.company.status ?? ""));
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setResolveError(String(e?.message ?? "Uventet feil ved oppslag av invitasjon."));
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [invite]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPostError(null);
    setOkMsg(null);

    // ekstra tydelig frontend-validering (før API)
    if (!invite) return setPostError("Mangler invitasjonskode.");
    if (!companyName) return setPostError("Invitasjonslenken er ikke gyldig.");
    if (name.trim().length < 2) return setPostError("Skriv inn navn (minst 2 tegn).");
    if (!isEmail(emailNorm)) return setPostError("Ugyldig e-postadresse.");
    if (password.length < 8) return setPostError("Passord må være minst 8 tegn.");
    if (!confirm) return setPostError("Du må bekrefte at du er ansatt i bedriften.");

    setPosting(true);
    try {
      const res = await fetch("/api/invite/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invite,
          name: name.trim(),
          email: emailNorm,
          password,
        }),
      });

      const json = (await res.json().catch(() => null)) as (JoinOk | JoinErr | null);

      if (!res.ok || !json || (json as any).ok === false) {
        throw new Error(pickMessage(json, "Registreringen kunne ikke fullføres."));
      }

      setOkMsg("Bruker opprettet. Du kan nå logge inn.");
      setTimeout(() => router.push("/login"), 600);
    } catch (e: any) {
      setPostError(String(e?.message ?? "Uventet feil ved registrering."));
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-3xl bg-white/70 p-8 ring-1 ring-[rgb(var(--lp-border))]">
        {/* Ansatt-advarselbanner */}
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <div className="font-semibold">Ansattregistrering</div>
          <div className="mt-1 opacity-80">
            Denne registreringen gjelder <b>kun ansatte</b> via invitasjonslenke. Firma-admin registreres i egen flyt.
          </div>
        </div>

        {/* Locked company */}
        <div className="mt-5 rounded-2xl bg-white px-4 py-3 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Firma (låst)</div>

          {loading ? (
            <div className="mt-1 text-sm text-[rgb(var(--lp-text))]">Sjekker invitasjonslenke…</div>
          ) : resolveError ? (
            <div className="mt-1 text-sm text-red-700">{resolveError}</div>
          ) : (
            <div className="mt-1 text-sm font-semibold text-[rgb(var(--lp-text))]">
              {companyName}
              {companyStatus ? (
                <span className="ml-2 text-xs font-normal text-[rgb(var(--lp-muted))]">({companyStatus})</span>
              ) : null}
            </div>
          )}

          <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
            Invitasjonskode: <span className="font-mono">{invite || "-"}</span>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Navn *</label>
            <input
              className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fornavn Etternavn"
              autoComplete="name"
              disabled={posting || !!resolveError || loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">E-post *</label>
            <input
              className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="navn@firma.no"
              autoComplete="email"
              disabled={posting || !!resolveError || loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Passord *</label>
            <input
              className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Minst 8 tegn"
              autoComplete="new-password"
              disabled={posting || !!resolveError || loading}
            />
          </div>

          {/* checkbox */}
          <label className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-[rgb(var(--lp-border))]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              disabled={posting || !!resolveError || loading}
            />
            <span className="text-sm text-[rgb(var(--lp-text))]">
              Jeg bekrefter at jeg er ansatt i <b>{companyName ?? "bedriften"}</b>, og at registreringen knytter brukeren
              min til riktig firma i Lunchportalen.
            </span>
          </label>

          {postError ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">{postError}</div>
          ) : null}

          {okMsg ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
              {okMsg}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              "w-full rounded-2xl px-5 py-3 text-sm font-medium ring-1 transition",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "bg-black text-white ring-black hover:bg-black/90",
            ].join(" ")}
          >
            {posting ? "Oppretter bruker…" : "Opprett bruker"}
          </button>

          <div className="pt-1 text-center text-sm text-[rgb(var(--lp-muted))]">
            Har du allerede konto?{" "}
            <Link href="/login" className="font-medium text-[rgb(var(--lp-text))] underline underline-offset-4">
              Logg inn
            </Link>
          </div>

          <div className="pt-1 text-center text-sm text-[rgb(var(--lp-muted))]">
            Er du firma-admin?{" "}
            <Link href="/registrering" className="font-medium text-[rgb(var(--lp-text))] underline underline-offset-4">
              Registrer bedrift
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
