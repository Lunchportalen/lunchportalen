# Protected content decision

## Locked statement (exactly one — this migration wave)

**Protected content (login-gated or segmented public marketing pages) is out of scope for this migration wave.**

Public website CMS pages delivered through the **published Delivery API** contract are **anonymous-read** content. Preview for such pages — if introduced later — is **blocked** until a **separate** authorization design is signed.

## Definitions

| Term | Meaning |
|------|---------|
| **Protected content** | Marketing or editorial pages that require **authenticated** visitor (member, customer segment, paywall) before **body** is revealed |
| **Private operational data** | Orders, menus, billing — **already** out of Umbraco scope; **not** “protected content” in this sense |

## If protected content becomes in scope later (explicitly — not assumed)

| Item | Requirement |
|------|-------------|
| **Why** | Business case documented (e.g. partner-only pages) |
| **Delivery** | **Member** or **server-to-server** authorized read — **not** anonymous Delivery API |
| **Preview** | **Must mirror** auth — **no** public signed URL that bypasses gate (`13-preview-delivery-foundation-prereqs.md` obligation) |
| **Blocked until** | Security architecture review + Umbraco product capability confirmation |

## What this decision does not say

- It does **not** claim employee/admin **app** routes (Next app shell) are “protected content” — those are **application auth**, separate from Umbraco Delivery.
- It does **not** forbid **future** expansion — it **forbids** **silent** introduction without the above.

## Sign-off

| Role | Action |
|------|--------|
| **Security owner** | Acknowledges anonymous Delivery for public marketing |
| **Product owner** | Confirms no gated marketing requirement at go-live |
