/**
 * Utvidelsespunkt for attributjon: klikk → produkt → kjøp → omsetning knyttet til kalenderpost.
 * Her: ren hjelper som oppdaterer postens performance (kan kobles til analytics/webhook senere).
 */

import type { Role } from "@/lib/ai/role";
import type { CalendarPost } from "@/lib/social/calendar";
import { syncRetargetingAudienceFlags } from "@/lib/growth/retargeting";
import { leadSourceIdFromPostId } from "@/lib/social/leadSource";
import { trackPost } from "@/lib/social/performance";

export type LinkClickAttribution = {
  postId: string;
  productId: string;
  /** Antall klikk å legge til */
  clicks?: number;
};

export type PurchaseAttribution = {
  postId: string;
  productId: string;
  revenue: number;
  conversions?: number;
};

export function attributeLinkClick(posts: CalendarPost[], e: LinkClickAttribution): CalendarPost[] {
  const next = trackPost(posts, e.postId, { clicks: e.clicks ?? 1 });
  return syncRetargetingAudienceFlags(next);
}

export function attributePurchaseRevenue(posts: CalendarPost[], e: PurchaseAttribution): CalendarPost[] {
  const next = trackPost(posts, e.postId, {
    revenue: e.revenue,
    conversions: e.conversions ?? 1,
  });
  return syncRetargetingAudienceFlags(next);
}

/** Registrert lead (f.eks. skjemainnsending knyttet til post). */
export function attributeLead(posts: CalendarPost[], postId: string, count = 1): CalendarPost[] {
  return syncRetargetingAudienceFlags(trackPost(posts, postId, { leads: count }));
}

export function attributeDemoBooking(posts: CalendarPost[], postId: string, count = 1): CalendarPost[] {
  return syncRetargetingAudienceFlags(trackPost(posts, postId, { demoBookings: count }));
}

export type DemoBookingMeta = {
  companySize?: string;
  industry?: string;
  leadId?: string;
  /** Målrolle knyttet til innlegget (segment) */
  targetRole?: Role;
};

/** Demo booket: teller + valgfri firmastørrelse/bransje (klient-lag inntil DB). */
export function recordDemoBookingForPost(
  posts: CalendarPost[],
  postId: string,
  meta: DemoBookingMeta,
  count = 1,
): CalendarPost[] {
  const ls = leadSourceIdFromPostId(postId);
  const withDemo = trackPost(posts, postId, { demoBookings: count });
  return syncRetargetingAudienceFlags(
    withDemo.map((p) =>
      p.id === postId
        ? {
            ...p,
            lastDemoBooked: {
              leadSourceId: p.leadSourceId ?? ls,
              companySize: meta.companySize,
              industry: meta.industry,
              leadId: meta.leadId,
              targetRole: meta.targetRole ?? p.targetRole,
              bookedAt: Date.now(),
            },
          }
        : p,
    ),
  );
}

/** Signert avtale / MRR knyttet til lead-kilde (finner post på leadSourceId eller post-id). */
export function attributeRevenueByLeadSource(
  posts: CalendarPost[],
  leadSourceId: string,
  revenue: number,
  conversions = 1,
): CalendarPost[] {
  const needle = String(leadSourceId ?? "").trim();
  if (!needle) return posts;
  const hit = posts.find((p) => p.leadSourceId === needle || leadSourceIdFromPostId(p.id) === needle);
  if (!hit) return posts;
  return attributePurchaseRevenue(posts, {
    postId: hit.id,
    productId: hit.productId,
    revenue,
    conversions,
  });
}
