import http from 'k6/http';

/**
 * Vercel Deployment Protection bypass for staging dry-runs.
 * Set VERCEL_AUTOMATION_BYPASS_SECRET in env (or via run.mjs from .env.local).
 */

const vuJars = {};

function vuJar() {
  const key = __VU;
  if (!vuJars[key]) {
    vuJars[key] = http.cookieJar();
  }
  return vuJars[key];
}

export function vercelBypassSecret() {
  return __ENV.VERCEL_AUTOMATION_BYPASS_SECRET || __ENV.VERCEL_PROTECTION_BYPASS || '';
}

export function withVercelBypassUrl(url) {
  const bypass = vercelBypassSecret();
  if (!bypass) return url;
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
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

function resolveRedirect(currentUrl, locationHeader) {
  if (!locationHeader) return currentUrl;
  if (locationHeader.startsWith('http://') || locationHeader.startsWith('https://')) {
    return withVercelBypassUrl(locationHeader);
  }
  const base = currentUrl.replace(/\/$/, '').split('/').slice(0, 3).join('/');
  const path = locationHeader.startsWith('/') ? locationHeader : `/${locationHeader}`;
  return withVercelBypassUrl(`${base}${path}`);
}

function lpRequest(method, url, body, params = {}) {
  let current = withVercelBypassUrl(url);
  const jar = vuJar();
  for (let depth = 0; depth < 8; depth += 1) {
    const headers = withVercelBypassHeaders(params.headers || {});
    const res = http.request(method, current, body, {
      ...params,
      headers,
      jar,
      redirects: 0,
    });
    if (res.status >= 300 && res.status < 400 && res.headers.Location) {
      current = resolveRedirect(current, res.headers.Location);
      continue;
    }
    return res;
  }
  throw new Error(`redirect count exceeded for ${url}`);
}

export function lpGet(url, params = {}) {
  return lpRequest('GET', url, null, params);
}

export function lpPost(url, body, params = {}) {
  return lpRequest('POST', url, body, params);
}

export function lpDel(url, params = {}) {
  return lpRequest('DELETE', url, null, params);
}

export function clearVuJar() {
  delete vuJars[__VU];
}
