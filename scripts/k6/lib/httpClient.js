import http from 'k6/http';

/**
 * Vercel Deployment Protection bypass for staging dry-runs.
 * K6_BYPASS_TOKEN is set by run.mjs when K6_TAG_ENV=staging.
 */
export function vercelBypassSecret() {
  return (
    __ENV.K6_BYPASS_TOKEN ||
    __ENV.VERCEL_AUTOMATION_BYPASS_SECRET ||
    __ENV.VERCEL_PROTECTION_BYPASS ||
    ''
  );
}

function splitAbsoluteUrl(pathOrUrl) {
  const m = String(pathOrUrl).match(/^(https?:\/\/[^/]+)(\/.*)?$/);
  if (!m) return { origin: '', path: pathOrUrl };
  return { origin: m[1], path: m[2] || '/' };
}

/** k6 (goja) has no global URL — string join only. */
export function buildUrl(baseUrl, path) {
  const base = String(baseUrl).replace(/\/$/, '');
  const pathNorm = String(path).startsWith('/') ? path : `/${path}`;
  let url = `${base}${pathNorm}`;
  const bypass = vercelBypassSecret();
  if (bypass) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  }
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

export function lpGet(baseUrl, pathOrUrl, params = {}) {
  const url = pathOrUrl.startsWith('http')
    ? (() => {
        const { origin, path } = splitAbsoluteUrl(pathOrUrl);
        return buildUrl(origin, path);
      })()
    : buildUrl(baseUrl, pathOrUrl);
  const headers = withVercelBypassHeaders(params.headers || {});
  return http.get(url, { ...params, headers });
}

export function lpPost(baseUrl, pathOrUrl, body, params = {}) {
  const url = pathOrUrl.startsWith('http')
    ? (() => {
        const { origin, path } = splitAbsoluteUrl(pathOrUrl);
        return buildUrl(origin, path);
      })()
    : buildUrl(baseUrl, pathOrUrl);
  const headers = withVercelBypassHeaders(params.headers || {});
  return http.post(url, body, { ...params, headers });
}
