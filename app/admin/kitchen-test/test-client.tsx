"use client";

// app/admin/kitchen-test/test-client.tsx
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function KitchenRpcTestClient() {
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setErr(null);
    setOut(null);

    const supabase = supabaseBrowser();

    // (1) Verifiser at du faktisk er innlogget
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.user?.id) {
      setLoading(false);
      setErr({ message: "Ikke innlogget i appen (auth.uid() blir null)." });
      return;
    }

    // (2) Kall RPC
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc("get_kitchen_orders", {
      p_from: today,
      p_to: today,
      p_location_id: null,
    });

    setLoading(false);

    if (error) {
      setErr(error);
      return;
    }
    setOut(data);
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <button
        onClick={run}
        disabled={loading}
        className="rounded-xl border px-4 py-2"
      >
        {loading ? "Tester..." : "Kjør RPC-test"}
      </button>

      {err && (
        <pre className="mt-4 whitespace-pre-wrap rounded-xl border p-3 text-sm">
          {JSON.stringify(err, null, 2)}
        </pre>
      )}

      {out && (
        <pre className="mt-4 whitespace-pre-wrap rounded-xl border p-3 text-sm">
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  );
}
