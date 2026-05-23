import { check } from 'k6';
import http from 'k6/http';

import { vercelBypassSecret, lpGet, lpPost } from './httpClient.js';
import { getConfig } from './data.js';

function hasAuthCookieInJar(baseUrl) {
  try {
    const jar = http.cookieJar();
    const cookies = jar.cookiesForURL(baseUrl) || {};
    return Object.keys(cookies).some(
      (name) => name.startsWith('sb-') && name.includes('auth-token'),
    );
  } catch {
    return false;
  }
}

/** Prime Vercel Deployment Protection bypass cookie before auth. */
export function primeVercelBypass(baseUrl) {
  if (!vercelBypassSecret()) return;
  lpGet(baseUrl, '/api/health', {
    tags: { scenario: 'auth', endpoint: 'bypass_warmup', env: __ENV.K6_TAG_ENV || 'prod' },
  });
}

/**
 * Cookie-based login via POST /api/auth/login (Supabase SSR cookies).
 * k6 stores Set-Cookie automatically in the VU cookie jar.
 */
export function login(baseUrl, email, password) {
  primeVercelBypass(baseUrl);
  const res = lpPost(
    baseUrl,
    '/api/auth/login',
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'auth', endpoint: 'login', env: __ENV.K6_TAG_ENV || 'prod' },
    },
  );

  check(res, {
    'login 200': (r) => r.status === 200,
    'login ok body': (r) => {
      try {
        const body = r.json();
        return body && body.ok === true;
      } catch {
        return false;
      }
    },
    'has session cookie': (r) => hasSupabaseAuthCookie(r),
  });

  return res;
}

export function hasSupabaseAuthCookie(res) {
  const cookies = res.cookies || {};
  return Object.keys(cookies).some(
    (name) => name.startsWith('sb-') && name.includes('auth-token'),
  );
}

/** Per-VU auth: setup() cookies are not shared with scenario VUs in k6. */
export function ensureVuAuth() {
  const config = getConfig();
  primeVercelBypass(config.baseUrl);
  if (hasAuthCookieInJar(config.baseUrl)) {
    return;
  }
  const res = login(config.baseUrl, config.email, config.password);
  if (res.status !== 200 || !hasSupabaseAuthCookie(res)) {
    throw new Error(`VU login failed for ${config.email} (${res.status})`);
  }
}

/** Per-VU setup: authenticate once and reuse cookie jar for all iterations. */
export function setupAuth() {
  const config = getConfig();
  const res = login(config.baseUrl, config.email, config.password);
  if (res.status !== 200 || !hasSupabaseAuthCookie(res)) {
    throw new Error(`Login failed for ${config.email} (${res.status})`);
  }
  return { config };
}

export function authParams(scenario, endpoint) {
  return {
    tags: {
      scenario,
      endpoint,
      env: __ENV.K6_TAG_ENV || 'prod',
      expected: 'true',
    },
  };
}
