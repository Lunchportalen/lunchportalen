# U28 — Replatforming gaps

| Krav | Gap | Forsvarlig på Next |
|------|-----|---------------------|
| Umbraco extension host (dynamiske menyer) | Krever annen runtime | Statiske komponenter + delte CSS-klasser |
| Management API full schema CRUD | .NET + DB-modell | Read-only endpoints + code registry |
| Property preset instances i DB | Egen motor | Code registry + usage counts fra innhold |
| Native distributed cache | Annen plattform | `force-dynamic` + eksplisitte API-grenser |

**Konklusjon:** U28 maksimerer **flyt- og kontrollparitet**; teknisk identitet forblir Next/Supabase.
