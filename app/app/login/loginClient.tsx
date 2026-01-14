"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginClient() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setMsg("Feil e-post eller passord.");
      return;
    }

    // Viktig: sørg for at SSR/middleware får oppdatert cookies før vi går videre
    router.refresh();
    router.replace("/today");
  }

  async function onRegister(e: React.MouseEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
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
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Logg inn</h1>
      <p className="mt-2 text-sm opacity-80">Logg inn for å bestille eller avbestille lunsj.</p>

      <form onSubmit={onLogin} className="mt-5 grid gap-3">
        <label className="text-sm">
          <div className="opacity-80">E-post</div>
          <input
            className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label className="text-sm">
          <div className="opacity-80">Passord</div>
          <input
            className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          disabled={busy}
          className={`mt-2 rounded-lg px-4 py-2 border ${
            busy ? "opacity-60 border-white/10" : "border-white/20 hover:bg-white/5"
          }`}
          type="submit"
        >
          {busy ? "Logger inn…" : "Logg inn"}
        </button>

        <button
          disabled={busy}
          onClick={onRegister}
          className={`rounded-lg px-4 py-2 border ${
            busy ? "opacity-60 border-white/10" : "border-white/20 hover:bg-white/5"
          }`}
          type="button"
        >
          Opprett bruker (test)
        </button>

        {msg ? <div className="text-sm mt-2">{msg}</div> : null}
      </form>
    </main>
  );
}
