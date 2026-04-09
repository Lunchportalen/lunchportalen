# CP10 — Hardening (WS7)

## Utført prinsipp

- **Fail-closed:** paletten utfører **kun** `router.push` til kjente `/backoffice/*` routes.
- **Ingen** nye API-endringer.
- **Ingen** auth-middleware-endring.

## Gjenstående (utenfor CP10-kode)

- Route-level access for alle backoffice-sider — **eksisterende** guards; ikke revidert i denne diffen.

## Ops

- Ingen ny runbook; se `CP10_VERIFICATION.md` for bygg/test.
