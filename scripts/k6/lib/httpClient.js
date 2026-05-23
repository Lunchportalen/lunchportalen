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

export function buildUrl(baseUrl, path) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  const bypass = vercelBypassSecret();
  if (bypass) {
    url.searchParams.set('x-vercel-set-bypass-cookie', 'true');
    url.searchParams.set('x-vercel-protection-bypass', bypass);
  }
  return url.toString();
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
    ? buildUrl(new URL(pathOrUrl).origin, `${new URL(pathOrUrl).pathname}${new URL(pathOrUrl).search}`)
    : buildUrl(baseUrl, pathOrUrl);
  const headers = withVercelBypassHeaders(params.headers || {});
  return http.get(url, { ...params, headers });
}

export function lpPost(baseUrl, pathOrUrl, body, params = {}) {
  const url = pathOrUrl.startsWith('http')
    ? buildUrl(new URL(pathOrUrl).origin, `${new URL(pathOrUrl).pathname}${new URL(pathOrUrl).search}`)
    : buildUrl(baseUrl, pathOrUrl);
  const headers = withVercelBypassHeaders(params.headers || {});
  return http.post(url, body, { ...params, headers });
}
