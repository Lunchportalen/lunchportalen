# CRON_AUTH

## Standard
All cron routes must authenticate with one of:
1. `Authorization: Bearer <CRON_SECRET>` (primary)
2. `x-cron-secret: <CRON_SECRET>` (fallback)

`?key=` in URL is prohibited.

## Shared Helper
- File: `lib/http/cronAuth.ts`
- Function: `requireCronAuth(req, options?)`
- Default env var: `CRON_SECRET`
- Optional env var override: `secretEnvVar` (used by system motor)

## Error Behavior
- Missing/invalid caller credential: `403`
- Missing server secret env: route returns `500 misconfigured`
- Secret value is never logged or returned.

## Curl Smoke Examples
```bash
# Without credential (expect 403)
curl -i "$BASE_URL/api/cron/outbox"

# With bearer (expect 200)
curl -i -X POST "$BASE_URL/api/cron/outbox" \
  -H "Authorization: Bearer $CRON_SECRET"

# With x-cron-secret (expect 200)
curl -i -X POST "$BASE_URL/api/cron/outbox" \
  -H "x-cron-secret: $CRON_SECRET"
```

## Vercel Cron Paths
`vercel.json` keeps clean paths without query secrets.
