# U20 — Open risks

1. **Superadmin-only discovery-bundle** — company-scoped redaktører får ikke samme palett-entiteter (akseptert for CMS control plane i denne fasen).
2. **Audit RLS vs service role** — API bruker `supabaseAdmin`; tilgang styres av API-laget, ikke direkte klient-RLS.
3. **Media `u20id`** — valgfri fremtidig UX; kan oppleves som «kun bibliotek» inntil fokus implementeres.
