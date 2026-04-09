# PHASE H2 — Next steps

1. **Kjør `H2_VERIFICATION.md`** på CI/prod-branch og arkiver resultat (tidsstempel).  
2. **Synk** `lib/pilot/vercelScheduledCrons.ts` ved **enhver** endring i `vercel.json` `crons`.  
3. **Vurder** dedikert test for `POST /api/dev/test-order-status` (prod-block).  
4. **API inventory:** utvid register / tillatte prefixer for pilot-tenant.  
5. **Worker:** implementer eller fjern stub-jobbtyper før bred live.  
6. **Stopp** — ingen nye funksjonsfaser før eksplisitt vedtak.
