# 🔐 LUNCHPORTALEN – MASTER SECURITY POLICY

Dette dokumentet definerer overordnet sikkerhetspolitikk.

---

# 1️⃣ FORMÅL

Sikre:

- Konfidensialitet
- Integritet
- Tilgjengelighet
- Sporbarhet
- Deterministisk drift

---

# 2️⃣ PRINSIPPER

- Database-first enforcement
- Least privilege
- Fail-closed
- No-exception rule
- Multi-tenant isolasjon
- Logging før handling

---

# 3️⃣ OMFANG

Gjelder:

- Applikasjon
- Database
- API
- CI/CD
- Leverandører

---

# 4️⃣ ROLLER

- CTO: Teknisk ansvar
- Security Officer: Overvåking
- Dev Team: Etterlevelse
- Styre: Overordnet kontroll

---

# 5️⃣ KRAV

- RLS på alle kritiske tabeller
- RPC-only writes
- CI guard aktiv
- Ingen service-role uten allowlist
- Årlig revisjon

---

# 6️⃣ OPPDATERING

Oppdateres årlig eller ved arkitekturendring.
