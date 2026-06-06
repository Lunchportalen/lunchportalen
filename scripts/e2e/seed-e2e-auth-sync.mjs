/**
 * Shared seed auth-sync policy — imported by seed-e2e-users.mjs and unit tests.
 *
 * auth.admin.updateUserById (password) revokes active Supabase refresh tokens / sessions.
 * Skip sync when credentials already work to avoid invalidating parallel CI harness sessions.
 */

/**
 * @param {{ userExists: boolean, loginVerified: boolean, emailConfirmed: boolean }} input
 * @returns {boolean}
 */
export function shouldSkipAuthPasswordSync({ userExists, loginVerified, emailConfirmed }) {
  return Boolean(userExists && loginVerified && emailConfirmed);
}

/**
 * @param {string} url
 * @param {string} anonKey
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function tryVerifyLogin(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.status === 200;
}
