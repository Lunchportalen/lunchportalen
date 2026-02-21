// app/login/login-client.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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
  | { ok: true; pending: true; reason?: string; retryAfterMs?: number; company_status?: string }
  | { ok: true; pending: false; profile: Profile; company_status?: string };

type ApiProfileErr = { ok: false; error: string; message?: string };

type ApiProfileRes = ApiProfileOk | ApiProfileErr;

type ApiLoginOk = { ok: true; rid: string; data: { user_id: string } };
type ApiLoginErr = { ok: false; rid: string; error: string; message: string; status: number };
type ApiLoginRes = ApiLoginOk | ApiLoginErr;

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function safeNextPath(n: string | null): string {
  if (!n) return "";
  if (!n.startsWith("/")) return "";
  if (n.startsWith("//")) return "";
  // Avoid redirecting back into login loop
  if (n.startsWith("/login")) return "/week";
  return n;
}

export default function LoginClient() {
  const sp = useSearchParams();
  const router = useRouter();

  // ✅ Support: /login?next=/week
  const nextPath = useMemo(() => safeNextPath(sp.get("next")), [sp]);

  const okParam = sp.get("ok");
  const prefillEmail = sp.get("email") ?? "";

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
      setMsg("Kontoen er opprettet. Logg inn for å komme i gang.");
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

    const MAX_ATTEMPTS = 5; // initial + retries
    const retryDelays = [120, 220, 400, 700];

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
          // cookies may not be read yet by the next server pass
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
            setPendingProfile(false);
            router.replace("/pending");
            router.refresh();
            return;
          }
          if (st === "paused" || st === "closed") {
            setPendingProfile(false);
            const to = `/status?state=${encodeURIComponent(st)}&next=${encodeURIComponent(next || "/week")}`;
            router.replace(to);
            router.refresh();
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
            setInfo("Kontoen er ikke aktiv ennå. Kontakt administrator.");
            return;
          }

          // ✅ IMPORTANT: use SPA navigation + refresh (no more “must reload”).
          setPendingProfile(false);

          const nextUrl = next || "/week";
          router.replace(nextUrl);
          router.refresh();
          return;
        } else {
          lastState = "technical";
        }
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelays[Math.min(attempt, retryDelays.length - 1)]);
      }
    }

    setPendingProfile(false);

    if (lastState === "pending") {
      setInfo("Vi setter opp kontoen din. Vent litt og prøv igjen hvis du ikke kommer videre.");
      return;
    }

    if (lastState === "auth_delay") {
      setInfo("Innloggingen bruker litt tid. Vent litt og prøv igjen.");
      return;
    }

    setError("Teknisk feil. Vent litt og prøv igjen.");
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

    // ✅ Enterprise-correct: client calls server login route (SSR cookies), no supabase browser client.
    let res: Response | null = null;
    let data: ApiLoginRes | null = null;

    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: eMail, password }),
      });

      data = (await res.json().catch(() => null)) as ApiLoginRes | null;
    } catch {
      setBusy(false);
      setError("Teknisk feil. Prøv igjen.");
      return;
    }

    setBusy(false);

    if (!res || !res.ok || !data || (data as any).ok !== true) {
      setError((data as any)?.message || "Feil e-post eller passord.");
      return;
    }

    // ✅ Immediately start readiness checks (profile/role gating)
    await postLoginReadiness(nextPath || "/week");
  }

  // ⚠️ KUN for test/dev. Ikke bruk i prod.
  // In this SSR/cookie model, registration should also be server-driven.
  // We keep the button but make it deterministic and safe.
  async function onRegister(e: React.MouseEvent) {
    e.preventDefault();
    setInfo("Registrering er deaktivert i produksjon. Kontakt firma-admin.");
  }

  const isBusy = busy || pendingProfile;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Logg inn</h1>
      <p className="mt-2 text-sm opacity-80">Tilgang for ansatte og administrator.</p>

      {isBusy ? (
        <div className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm">
          <div className="font-semibold">Logger deg trygt inn…</div>
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
            disabled={isBusy}
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
              disabled={isBusy}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 min-h-[44px] -translate-y-1/2 rounded-md px-3 text-xs font-semibold hover:bg-white/5"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              disabled={isBusy}
            >
              {showPassword ? "Skjul" : "Vis"}
            </button>
          </div>
        </label>

        <button
          disabled={isBusy}
          className={`mt-2 min-h-[48px] rounded-lg border px-4 py-2 ${
            isBusy ? "border-white/10 opacity-60" : "border-white/20 hover:bg-white/5"
          }`}
          type="submit"
        >
          {isBusy ? "Logger deg trygt inn…" : "Logg inn"}
        </button>

        <button
          disabled={isBusy}
          onClick={onRegister}
          className={`min-h-[48px] rounded-lg border px-4 py-2 ${
            isBusy ? "border-white/10 opacity-60" : "border-white/20 hover:bg-white/5"
          }`}
          type="button"
        >
          Opprett bruker (test)
        </button>

        {msg ? (
          <div className={`mt-2 text-sm${msgTone === "error" ? " text-red-500" : ""}`}>{msg}</div>
        ) : null}

        <a className="mt-2 text-sm underline opacity-80 hover:opacity-100" href="/forgot-password">
          Glemt passord?
        </a>
      </form>
    </main>
  );
}
