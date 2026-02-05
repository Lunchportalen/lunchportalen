// app/login/login-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Profile = {
  id: string;
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  disabled_reason: string | null;
};

type ApiProfileOk =
  | { ok: true; pending: true; reason?: string; retryAfterMs?: number }
  | { ok: true; pending: false; profile: Profile };

type ApiProfileErr = { ok: false; error: string; message?: string };

type ApiProfileRes = ApiProfileOk | ApiProfileErr;

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ Support: /login?next=/week
  const nextPath = useMemo(() => {
    const n = sp.get("next");
    if (!n || !n.startsWith("/")) return "";
    if (n.startsWith("//")) return "";
    return n;
  }, [sp]);

  const okParam = sp.get("ok");
  const prefillEmail = sp.get("email") ?? "";

  const supabase = supabaseBrowser();

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [pendingProfile, setPendingProfile] = useState(false);

  useEffect(() => {
    if (okParam === "invite_accepted") {
      setMsg("Kontoen er opprettet. Logg inn for å komme i gang.");
    }
  }, [okParam]);

  async function pollProfileAndRedirect() {
    setPendingProfile(true);

    const maxAttempts = 10;
    let delay = 450;

    for (let i = 0; i < maxAttempts; i++) {
      const r = await fetch("/api/profile", { cache: "no-store" });

      // ✅ 202 = pending (profil/trigger-latency)
      if (r.status === 202) {
        await sleep(delay);
        delay = Math.min(1500, Math.floor(delay * 1.4));
        continue;
      }

      const data = (await r.json().catch(() => null)) as ApiProfileRes | null;

      if (!data) {
        await sleep(delay);
        delay = Math.min(1500, Math.floor(delay * 1.4));
        continue;
      }

      // Ikke innlogget lenger / cookies ikke satt
      if (r.status === 401 || (data && "ok" in data && data.ok === false && data.error === "AUTH_REQUIRED")) {
        setPendingProfile(false);
        setMsg("Du er ikke innlogget. Prøv igjen.");
        return;
      }

      if (r.status === 403 && (data as any)?.ok && (data as any)?.profile) {
        const prof = (data as any).profile as Profile;
        if (prof?.disabled_at) {
          setPendingProfile(false);
          setMsg(prof.disabled_reason || "Kontoen er deaktivert. Kontakt administrator.");
          return;
        }
        if (prof?.is_active === false) {
          setPendingProfile(false);
          setMsg("Kontoen er ikke aktiv ennå. Kontakt administrator.");
          return;
        }
      }

      // ✅ Pending company status
      if (r.status === 200 && data.ok === true && data.pending === true && (data as any).company_status) {
        const st = String((data as any).company_status ?? "").toLowerCase();
        if (st === "pending") {
          router.replace("/pending");
          return;
        }
        if (st === "paused" || st === "closed") {
          router.replace(`/status?state=${encodeURIComponent(st)}&next=${encodeURIComponent(nextPath || "/week")}`);
          return;
        }
      }

      // ✅ Klar
      if (r.status === 200 && data.ok === true && data.pending === false) {
        const prof = data.profile as Profile;

        // Sperre: deaktivert
        if (prof?.disabled_at) {
          setPendingProfile(false);
          setMsg(prof.disabled_reason || "Kontoen er deaktivert. Kontakt administrator.");
          return;
        }

        // Sperre: ikke aktiv
        if (prof?.is_active === false) {
          setPendingProfile(false);
          setMsg("Kontoen er ikke aktiv ennå. Kontakt administrator.");
          return;
        }

        router.refresh();
        router.replace("/api/auth/post-login");
        return;
      }

      // Alt annet → vent litt og prøv igjen
      await sleep(delay);
      delay = Math.min(1500, Math.floor(delay * 1.4));
    }

    setPendingProfile(false);
    setMsg("Vi setter opp kontoen din. Vent litt og prøv å logge inn på nytt hvis du ikke kommer videre.");
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pendingProfile) return;

    setMsg("");
    setBusy(true);

    const eMail = email.trim().toLowerCase();

    if (!isEmail(eMail)) {
      setBusy(false);
      setMsg("Skriv inn en gyldig e-postadresse.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: eMail,
      password,
    });

    setBusy(false);

    if (error) {
      setMsg("Feil e-post eller passord.");
      return;
    }

    // Viktig: sørg for at SSR/middleware får oppdatert cookies før vi går videre
    router.refresh();

    await pollProfileAndRedirect();
  }

  // ⚠️ KUN for test/dev. Ikke bruk i prod.
  async function onRegister(e: React.MouseEvent) {
    e.preventDefault();
    if (busy || pendingProfile) return;

    setMsg("");
    setBusy(true);

    const eMail = email.trim().toLowerCase();

    if (!isEmail(eMail)) {
      setBusy(false);
      setMsg("Skriv inn en gyldig e-postadresse.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: eMail,
      password,
    });

    setBusy(false);

    if (error) {
      setMsg(`Kunne ikke opprette bruker: ${error.message}`);
      return;
    }

    setMsg("Bruker opprettet. Du kan nå logge inn.");
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Logg inn</h1>
      <p className="mt-2 text-sm opacity-80">Logg inn for å bestille eller avbestille lunsj.</p>

      {pendingProfile ? (
        <div className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm">
          <div className="font-semibold">Setter opp kontoen din…</div>
          <div className="mt-1 opacity-80">Dette tar vanligvis bare et øyeblikk.</div>
        </div>
      ) : null}

      <form onSubmit={onLogin} className="mt-5 grid gap-3">
        <label className="text-sm">
          <div className="opacity-80">E-post</div>
          <input
            className="mt-2 w-full min-h-[44px] rounded-lg border border-white/15 bg-transparent px-3 py-2 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            disabled={busy || pendingProfile}
          />
        </label>

        <label className="text-sm">
          <div className="opacity-80">Passord</div>
          <div className="relative">
            <input
              className="mt-2 w-full min-h-[44px] rounded-lg border border-white/15 bg-transparent px-3 py-2 pr-12 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={busy || pendingProfile}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 min-h-[44px] -translate-y-1/2 rounded-md px-3 text-xs font-semibold hover:bg-white/5"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? "Skjul" : "Vis"}
            </button>
          </div>
        </label>

        <button
          disabled={busy || pendingProfile}
          className={`mt-2 min-h-[48px] rounded-lg border px-4 py-2 ${
            busy || pendingProfile ? "border-white/10 opacity-60" : "border-white/20 hover:bg-white/5"
          }`}
          type="submit"
        >
          {pendingProfile ? "Setter opp…" : busy ? "Logger inn…" : "Logg inn"}
        </button>

        <button
          disabled={busy || pendingProfile}
          onClick={onRegister}
          className={`min-h-[48px] rounded-lg border px-4 py-2 ${
            busy || pendingProfile ? "border-white/10 opacity-60" : "border-white/20 hover:bg-white/5"
          }`}
          type="button"
        >
          Opprett bruker (test)
        </button>

        {msg ? <div className="mt-2 text-sm">{msg}</div> : null}
      </form>
    </main>
  );
}


