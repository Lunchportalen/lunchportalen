# Utgående integrasjoner (valgfritt)

Alle variabler er **valgfrie**. Uten dem fortsetter hovedflyten som normalt.

```bash
# Resend (e-post)
RESEND_API_KEY=
# Valgfri avsender (standard: se `RESEND_DEFAULT_FROM` i `lib/system/emails.ts`)
RESEND_FROM=

# Varsling ved ny lead (POST /api/revenue/lead) — uten denne sendes ingen e-post
LEAD_NOTIFICATION_EMAIL=

# CRM-webhook (POST JSON payload ved lead)
CRM_WEBHOOK=

# Annonsenettverk / ekstern webhook ved skaleringshandling (autonom «scale»)
ADS_WEBHOOK=
```
