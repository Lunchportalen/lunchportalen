import { check } from 'k6';

import { clearVuJar, lpGet, lpPost } from './httpClient.js';
import { getConfig } from './data.js';

const vuLoginState = {};

/** Prime Vercel Deployment Protection bypass cookie before auth. */
export function primeVercelBypass(baseUrl) {
  lpGet(`${baseUrl}/api/health`, {
    tags: { scenario: 'auth', endpoint: 'bypass_warmup', env: __ENV.K6_TAG_ENV || 'prod' },
  });
}

/**
 * Cookie-based login via POST /api/auth/login (Supabase SSR cookies).
 * Uses per-VU cookie jar — never k6 setup().
 */
export function login(baseUrl, email, password, scenario = 'auth') {
  primeVercelBypass(baseUrl);
  const res = lpPost(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario, endpoint: 'login', env: __ENV.K6_TAG_ENV || 'prod' },
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

/** One stable login per VU per actor key. */
export function ensureActorLogin(actorKey, email, password) {
  const vu = __VU;
  const cacheKey = `${vu}:${actorKey}`;
  if (vuLoginState[cacheKey]) return vuLoginState[cacheKey];

  clearVuJar();
  const config = getConfig();
  const res = login(config.baseUrl, email, password, actorKey);
  if (res.status !== 200 || !hasSupabaseAuthCookie(res)) {
    throw new Error(`Login failed for ${actorKey} (${res.status})`);
  }
  vuLoginState[cacheKey] = { ok: true };
  return vuLoginState[cacheKey];
}

export function logout(baseUrl, scenario) {
  const res = lpPost(`${baseUrl}/api/auth/logout`, null, {
    tags: { scenario, endpoint: 'logout', env: __ENV.K6_TAG_ENV || 'prod' },
  });
  check(res, {
    'logout acceptable': (r) => r.status >= 200 && r.status < 500,
  });
  clearVuJar();
  return res;
}

/** setup() — metadata only; no session cookies. */
export function setupReadiness() {
  const config = getConfig();
  if (!config.baseUrl.includes('staging.app.lunchportalen.no') && __ENV.K6_TAG_ENV === 'staging') {
    throw new Error('Staging k6 must target staging.app.lunchportalen.no');
  }
  primeVercelBypass(config.baseUrl);
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
