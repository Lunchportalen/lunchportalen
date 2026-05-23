import http from 'k6/http';

/**
 * Vercel Deployment Protection bypass for staging dry-runs.
 * Set VERCEL_AUTOMATION_BYPASS_SECRET in env (or via run.mjs from .env.local).
 */
export function vercelBypassSecret() {
  return __ENV.VERCEL_AUTOMATION_BYPASS_SECRET || __ENV.VERCEL_PROTECTION_BYPASS || '';
}

export function withVercelBypassUrl(url) {
  // Prefer header-based bypass — query params can be stripped on 307 redirects.
  return url;
}

export function withVercelBypassHeaders(headers = {}) {
  const bypass = vercelBypassSecret();
  if (!bypass) return headers;
  return {
    ...headers,
    'x-vercel-protection-bypass': bypass,
    'x-vercel-set-bypass-cookie': 'true',
  };
}

export function lpGet(url, params = {}) {
  const finalUrl = withVercelBypassUrl(url);
  const headers = withVercelBypassHeaders(params.headers || {});
  return http.get(finalUrl, { ...params, headers });
}

export function lpPost(url, body, params = {}) {
  const finalUrl = withVercelBypassUrl(url);
  const headers = withVercelBypassHeaders(params.headers || {});
  return http.post(finalUrl, body, { ...params, headers });
}
