/**
 * Build Cookie header for Next middleware from a GoTrue session via /api/auth/login.
 */
export async function loginCookieJar(baseUrl, email, password) {
  const base = String(baseUrl).replace(/\/$/, "");
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = setCookie.length
    ? setCookie
    : String(res.headers.get("set-cookie") || "")
        .split(/,(?=[^;]+?=)/)
        .filter(Boolean);
  const cookies = [];
  for (const c of raw) {
    const part = String(c).split(";")[0].trim();
    if (part) cookies.push(part);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(`login ${email}: HTTP ${res.status} ${json?.message || json?.error || ""}`);
  }
  if (!cookies.some((c) => c.startsWith("sb-") && c.includes("auth-token"))) {
    throw new Error(`login ${email}: missing sb-*-auth-token cookie`);
  }
  return { cookie: cookies.join("; "), status: res.status, json };
}

export function cookieHeaderFromSessionTokens(accessToken, refreshToken, projectRef = "127") {
  // Fallback when login endpoint unavailable — middleware needs sb-*-auth-token jar.
  const payload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
  return `sb-${projectRef}-auth-token=${encodeURIComponent(payload)}`;
}
