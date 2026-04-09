// scripts/sanity-live.mjs

// Try to load .env/.env.local for Node scripts (enterprise: deterministic env behavior)
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  await import("dotenv/config");
} catch {
  // If dotenv isn't installed, continue (CI might inject env vars anyway)
}

const envBase =
  process.env.SANITY_LIVE_URL || // ✅ explicit for this script
  process.env.PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.VERCEL_URL ||
  process.env.NEXT_PUBLIC_VERCEL_URL ||
  "http://localhost:3000";

const base = (() => {
  let b = String(envBase || "").trim();
  if (!b) return "http://localhost:3000";

  // Support hostname-only env (e.g. Vercel)
  if (!b.startsWith("http://") && !b.startsWith("https://")) {
    b = `https://${b}`;
  }

  // normalize: no trailing slashes
  return b.replace(/\/+$/, "");
})();

function urlFor(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${base}${path}`;
}

function abortableTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error("timeout")), ms);
  return { controller, cancel: () => clearTimeout(id) };
}

async function fetchJson(url, opts = {}) {
  const timeoutMs = Number(process.env.SANITY_FETCH_TIMEOUT_MS || 12_000);
  const { controller, cancel } = abortableTimeout(timeoutMs);

  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        "cache-control": "no-store",
        "accept": "application/json",
        ...(opts.headers || {}),
      },
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let json = null;
    let text = null;

    // Try JSON first if content-type hints it
    if (ct.includes("application/json")) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    } else {
      // fallback: read small text body for error context (avoid huge blobs)
      try {
        text = (await res.text()).slice(0, 500);
      } catch {
        text = null;
      }
    }

    return { res, json, text };
  } finally {
    cancel();
  }
}

function fatal(code, payload) {
  console.error(code, payload);
  process.exitCode = 1;
  throw new Error(code);
}

async function run() {
  // 🔎 Always print what we are about to do (fixes "fetch failed" mystery)
  console.log("[sanity:live] base =", base);
  console.log("[sanity:live] env =", {
    SANITY_LIVE_URL: process.env.SANITY_LIVE_URL,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  });

  // Primary health endpoint
  const healthUrl = urlFor("/api/health");
  console.log("[sanity:live] GET", healthUrl);
  let health = await fetchJson(healthUrl);

  if (!health.res.ok) {
    fatal("health_failed", {
      url: healthUrl,
      status: health.res.status,
      body: health.json ?? health.text ?? null,
    });
  }
  if (!health.json || health.json.ok !== true) {
    fatal("health_failed", {
      url: healthUrl,
      status: health.res.status,
      body: health.json ?? health.text ?? null,
      reason: "expected { ok: true }",
    });
  }

  console.log("[sanity:live] runtime =", health.json?.data?.checks?.runtime?.mode ?? "unknown");

  // Optional cron gate (only if secret is provided)
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (cronSecret) {
    const cronUrl = urlFor("/api/cron/daily-sanity");
    console.log("[sanity:live] POST", cronUrl, "(x-cron-secret present)");
    const cron = await fetchJson(cronUrl, { headers: { "x-cron-secret": cronSecret } });

    if (!cron.res.ok) {
      fatal("daily_sanity_failed", {
        url: cronUrl,
        status: cron.res.status,
        body: cron.json ?? cron.text ?? null,
      });
    }
    if (!cron.json || cron.json.ok !== true) {
      fatal("daily_sanity_failed", {
        url: cronUrl,
        status: cron.res.status,
        body: cron.json ?? cron.text ?? null,
        reason: "expected { ok: true }",
      });
    }
  } else {
    console.log("[sanity:live] CRON_SECRET not set, skipping /api/cron/daily-sanity");
  }

  console.log("[sanity:live] OK");
  process.exitCode = 0;
}

run().catch((e) => {
  console.error("sanity_live_error", {
    message: e?.message || String(e),
    name: e?.name,
    cause: e?.cause ? String(e.cause) : undefined,
    base,
  });
  process.exitCode = 1;
});
