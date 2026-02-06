// app/login/login-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const sp = useSearchParams();

  // âœ… Support: /login?next=/week
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
  const [msgTone, setMsgTone] = useState<"info" | "error">("info");
  const [pendingProfile, setPendingProfile] = useState(false);

  useEffect(() => {
    if (okParam === "invite_accepted") {
      setMsgTone("info");
      setMsg("Kontoen er opprettet. Logg inn for Ã¥ komme i gang.");
    }
  }, [okParam]);

  function setInfo(message: string) {
    setMsgTone("info");
    setMsg(message);
  }

  function setError(message: string) {
    setMsgTone("error");
    setMsg(message);
  }

  async function postLoginReadiness(next: string) {
    setPendingProfile(true);
    setMsg("");

    const MAX_ATTEMPTS = 4; // initial + 3 retries
    const retryDelays = [200, 500, 900];
    let lastState: "pending" | "auth_delay" | "technical" | "unknown" = "unknown";

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let r: Response | null = null;
      let data: ApiProfileRes | null = null;

      try {
        r = await fetch("/api/profile", { cache: "no-store" });
        data = (await r.json().catch(() => null)) as ApiProfileRes | null;
      } catch {
        lastState = "technical";
      }

      if (r) {
        if (r.status === 401 || r.status === 403) {
          lastState = "auth_delay";
        } else if (r.status === 202) {
          lastState = "pending";
        } else if (r.status >= 500) {
          lastState = "technical";
        } else if (data && data.ok === false && data.error === "AUTH_REQUIRED") {
          lastState = "auth_delay";
        } else if (data && data.ok === true && data.pending === true) {
          const st = String((data as any).company_status ?? "").toLowerCase();
          if (st === "pending") {
            window.location.assign("/pending");
            return;
          }
          if (st === "paused" || st === "closed") {
            window.location.assign(`/status?state=${encodeURIComponent(st)}&next=${encodeURIComponent(next || "/week")}`);
            return;
          }
          lastState = "pending";
        } else if (data && data.ok === true && data.pending === false) {
          const prof = data.profile as Profile;

          if (prof?.disabled_at) {
            setPendingProfile(false);
            setInfo(prof.disabled_reason || "Kontoen er deaktivert. Kontakt administrator.");
            return;
          }

          if (prof?.is_active === false) {
            setPendingProfile(false);
            setInfo("Kontoen er ikke aktiv ennÃ¥. Kontakt administrator.");
            return;
          }

          const nextUrl = next || "/week";
          const postLoginUrl = `/api/auth/post-login?next=${encodeURIComponent(nextUrl)}`;
          // Hard redirect avoids SPA session/profile race that previously required manual refresh.
          window.location.assign(postLoginUrl);
          return;
        } else {
          lastState = "technical";
        }
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelays[attempt]);
      }
    }

    setPendingProfile(false);

    if (lastState === "pending") {
      setInfo("Vi setter opp kontoen din. Vent litt og prÃ¸v igjen hvis du ikke kommer videre.");
      return;
    }

    if (lastState === "auth_delay") {
      setInfo("Innloggingen bruker litt tid. Vent litt og prÃ¸v igjen.");
      return;
    }

    setError("Teknisk feil. Vent litt og prÃ¸v igjen.");
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pendingProfile) return;

    setMsg("");
    setMsgTone("info");
    setBusy(true);

    const eMail = email.trim().toLowerCase();

    if (!isEmail(eMail)) {
      setBusy(false);
      setInfo("Skriv inn en gyldig e-postadresse.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: eMail,
      password,
    });

    setBusy(false);

    if (error) {
      setError("Feil e-post eller passord.");
      return;
    }

    await postLoginReadiness(nextPath || "/week");
  }

  // âš ï¸ KUN for test/dev. Ikke bruk i prod.
  async function onRegister(e: React.MouseEvent) {
    e.preventDefault();
    if (busy || pendingProfile) return;

    setMsg("");
    setMsgTone("info");
    setBusy(true);

    const eMail = email.trim().toLowerCase();

    if (!isEmail(eMail)) {
      setBusy(false);
      setInfo("Skriv inn en gyldig e-postadresse.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: eMail,
      password,
    });

    setBusy(false);

    if (error) {
      setInfo(`Kunne ikke opprette bruker: ${error.message}`);
      return;
    }

    setInfo("Bruker opprettet. Du kan nÃ¥ logge inn.");
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Logg inn</h1>
      <p className="mt-2 text-sm opacity-80">Logg inn for Ã¥ bestille eller avbestille lunsj.</p>

      {busy || pendingProfile ? (
        <div className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm">
          <div className="font-semibold">Logger deg trygt inn…</div>
          <div className="mt-1 opacity-80">Dette tar vanligvis bare et Ã¸yeblikk.</div>
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
          {pendingProfile ? "Logger deg trygt inn…" : busy ? "Logger deg trygt inn…" : "Logg inn"}
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

        {msg ? (
          <div className={`mt-2 text-sm${msgTone === "error" ? " text-red-500" : ""}`}>{msg}</div>
        ) : null}
      </form>
    </main>
  );
}
