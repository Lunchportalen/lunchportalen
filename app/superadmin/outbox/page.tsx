// app/superadmin/outbox/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import OutboxClient from "./outbox-client";

/**
 * NOTE:
 * - Superadmin-tilgang er allerede validert i /superadmin layout.
 * - Denne siden skal IKKE gjøre redirect().
 * - Redirect her gir 307-loop i App Router.
 */
export default function SuperadminOutboxPage() {
  return <OutboxClient />;
}
