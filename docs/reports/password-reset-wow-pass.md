# Password Reset — WOW Pass

Title: Password reset (Glemt passord) full flow
Scope: Auth UI + forgot password API + reset password page + auth allowlists
Repro: Gå til `/login` → klikk “Glemt passord?” → send lenke → åpne reset-lenke → sett nytt passord
Expected: Alltid ikke-utforskende bekreftelse; lenke fungerer; nytt passord settes; redirect til `/login`
Actual: Manglet komplett reset-side og custom e-post; ikke-utforskende bekreftelse var ikke garantert
Root cause: Manglende end-to-end reset flow og ingen custom recovery e-post
Fix: Ny forgot-password API + ny reset-password side + link fra login + oppdaterte allowlists
Verification: Se sjekkliste under

Files changed
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/api/auth/forgot-password/route.ts`
- `app/login/LoginForm.tsx`
- `app/login/page.tsx`
- `app/layout.tsx`
- `components/layout/AppChrome.tsx`
- `app/admin/layout.tsx`
- `app/api/auth/redirect/route.ts`
- `app/api/auth/post-login/route.ts`
- `AGENTS.md`

Flow summary
- Login viser “Glemt passord?” og peker til `/forgot-password`
- `/forgot-password` sender recovery-lenke via API og viser alltid samme bekreftelse ved OK
- API genererer Supabase recovery-link og sender e-post med fast copy
- `/reset-password` lar brukeren sette nytt passord og redirecter til `/login`
- Allowlists blokkerer ikke `reset-password` og unngår login-loop

Verification checklist
- iPhone Safari: Login → Glemt passord → Send lenke → bekreftelse vises
- iPhone Safari: Åpne reset-lenke → nytt passord → redirect til `/login`
- Desktop: Samme flyt
- Non-enumeration: Ugyldig e-post viser samme bekreftelse ved OK
- Ingen horisontal scroll eller offscreen elementer
