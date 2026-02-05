// scripts/sanity-live.mjs
const envBase =
  process.env.PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_VERCEL_URL ||
  "http://localhost:3000";

const base = (() => {
  let b = String(envBase || "").trim();
  if (!b) return "http://localhost:3000";
  if (b.startsWith("http://") || b.startsWith("https://")) return b.replace(/\/+$/, "");
  // Vercel provides hostname only
  return `https://${b.replace(/\/+$/, "")}`;
})();

function urlFor(path) {
  return `${base}${path}`;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "cache-control": "no-store",
      ...(opts.headers || {}),
    },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { res, json };
}

async function run() {
  const healthUrl = urlFor("/api/health");
  const health = await fetchJson(healthUrl);

  if (!health.res.ok || !health.json || health.json.ok !== true) {
    console.error("health_failed", { status: health.res.status, body: health.json });
    process.exit(1);
  }

  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (cronSecret) {
    const cronUrl = urlFor("/api/cron/daily-sanity");
    const cron = await fetchJson(cronUrl, { headers: { "x-cron-secret": cronSecret } });

    if (!cron.res.ok || !cron.json || cron.json.ok !== true) {
      console.error("daily_sanity_failed", { status: cron.res.status, body: cron.json });
      process.exit(1);
    }
  }

  process.exit(0);
}

run().catch((e) => {
  console.error("sanity_live_error", { message: e?.message || String(e) });
  process.exit(1);
});
