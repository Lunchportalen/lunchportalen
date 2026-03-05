/**
 * One-time seed: mirror hard-coded UI text from app pages into CMS overlay pages.
 * Idempotent: creates or updates content_pages + content_page_variants (nb/prod).
 * No business logic changes. Run from repo root with env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *
 * Run: npx tsx scripts/seedAppOverlaysFromHardcoded.ts
 */

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type { BlockList, BlockNode } from "../lib/cms/model/blockTypes";
import { APP_OVERLAYS } from "../lib/cms/overlays/registry";

const LOCALE = "nb";
const ENVIRONMENT = "prod";

function block(id: string, type: string, data: Record<string, unknown>): BlockNode {
  return { id, type, data };
}

/** Overlay bodies: verbatim-ish strings from app/(portal)/week, (app)/dashboard, admin, superadmin, kitchen, driver. */
export function buildOverlayBodies(): Record<string, BlockList> {
  return {
    [APP_OVERLAYS.week.slug]: {
      version: 1,
      blocks: [
        block("seed-week-header", "hero", {
          slot: "header",
          title: "Ukeplan â€“ Lunchportalen",
          subtitle: "Bestill eller avbestill lunsj for uken. Cut-off kl. 08:00 samme dag.",
        }),
        block("seed-week-help", "richText", {
          slot: "help",
          heading: "Endringer kan gjÃ¸res frem til 08:00 samme dag.",
          body: "Neste uke Ã¥pner torsdag kl. 08:00.",
        }),
        block("seed-week-empty", "richText", {
          slot: "emptyState",
          heading: "Ingen aktiv avtale",
          body: "Ingen uke er tilgjengelig akkurat nÃ¥.",
        }),
      ],
    },
    [APP_OVERLAYS.dashboard.slug]: {
      version: 1,
      blocks: [
        block("seed-dash-header", "hero", {
          slot: "header",
          title: "Lunchportalen",
          subtitle: "System: OK â€¢ Oslo",
        }),
        block("seed-dash-help", "richText", {
          slot: "help",
          heading: "Dagens leveringer",
          body:
            "Her legger vi den operative listen: leveringsvindu â†’ firma â†’ lokasjon â†’ ansatte. Fokus: utskrift/eksport, status (QUEUED/PACKED/DELIVERED), og avvik.",
        }),
      ],
    },
    [APP_OVERLAYS.companyAdmin.slug]: {
      version: 1,
      blocks: [
        block("seed-admin-header", "hero", {
          slot: "header",
          title: "Oversikt",
          subtitle: "Kontroll, status og neste handling â€” uten stÃ¸y.",
        }),
        block("seed-admin-help", "richText", {
          slot: "help",
          heading: "Systemregler",
          body:
            "Avbestilling samme dag fÃ¸r kl. 08:00 (Europe/Oslo). Neste uke Ã¥pner torsdag kl. 08:00. Systemet er Ã©n sannhetskilde â€” ingen manuelle overstyringer.",
        }),
        block("seed-admin-empty", "richText", {
          slot: "emptyState",
          heading: "Ingen aktivitet Ã¥ vise",
          body:
            "NÃ¥r bestillinger/avbestillinger og endringer logges, vil de vises her i en kort, driftstilpasset feed.",
        }),
        block("seed-admin-footer", "cta", {
          slot: "footerCta",
          title: "Dashboard 2.0 viser kun beslutningsverdi. Detaljer ligger pÃ¥ undersider.",
          body: "",
          buttonLabel: "Til ansattvisning â†’",
          href: "/week",
        }),
      ],
    },
    [APP_OVERLAYS.superadmin.slug]: {
      version: 1,
      blocks: [
        block("seed-super-header", "hero", {
          slot: "header",
          title: "Superadmin",
          subtitle: "Systemtid (Oslo): vises Ã¸verst. Oslo-tid er fasit.",
        }),
        block("seed-super-help", "richText", {
          slot: "help",
          heading: "Systemtid (Oslo)",
          body: "Cut-off og tidsstempler vises i banner Ã¸verst. Bruk firmalisten og undersider for Ã¥ administrere.",
        }),
      ],
    },
    [APP_OVERLAYS.kitchen.slug]: {
      version: 1,
      blocks: [
        block("seed-kitchen-header", "hero", {
          slot: "header",
          title: "KjÃ¸kken",
          subtitle:
            "Dagens produksjonsliste. Ordrene er gruppert per leveringsvindu, firma og lokasjon. Dette er fasit.",
        }),
        block("seed-kitchen-help", "richText", {
          slot: "help",
          heading: "Driftsnotat",
          body:
            "Dato fÃ¸lger Oslo-tid. Utskrift: bruk nettleserens print. Endringer etter cut-off registreres som avvik.",
        }),
      ],
    },
    [APP_OVERLAYS.driver.slug]: {
      version: 1,
      blocks: [
        block("seed-driver-header", "hero", {
          slot: "header",
          title: "SjÃ¥fÃ¸r",
          subtitle:
            "Dagens leveringer er gruppert per tidsvindu, firma og lokasjon. Dette er fasit.",
        }),
        block("seed-driver-help", "richText", {
          slot: "help",
          heading: "Driftsnotat",
          body:
            "Dagens stopp fÃ¸lger Oslo-tid. FÃ¸lg tidsvinduene for hver lokasjon. Eventuelle avvik registreres etter levering.",
        }),
      ],
    },
  };
}

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (process.env.NODE_ENV !== "production") {
    console.log("[seedAppOverlays] env", {
      hasSupabaseUrl: Boolean(url),
      hasServiceRole: Boolean(serviceRoleKey),
    });
  }

  if (!url || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);
  const now = new Date().toISOString();
  const bodies = buildOverlayBodies();

  for (const key of Object.keys(APP_OVERLAYS) as Array<keyof typeof APP_OVERLAYS>) {
    const entry = APP_OVERLAYS[key];
    const slug = entry.slug;
    const title = entry.title;
    const body = bodies[slug];
    if (!body || !body.blocks?.length) {
      console.log(`[${slug}] skip: no body`);
      continue;
    }

    let pageId: string;
    const { data: existingPage } = await supabase
      .from("content_pages")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingPage?.id) {
      await supabase
        .from("content_pages")
        .update({ title, updated_at: now })
        .eq("id", existingPage.id);
      pageId = existingPage.id;
      console.log(`[${slug}] updated page`);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("content_pages")
        .insert({
          title,
          slug,
          status: "draft",
          updated_at: now,
        })
        .select("id")
        .single();
      if (insertErr || !inserted?.id) {
        console.error(`[${slug}] failed to create page:`, insertErr?.message ?? "no id");
        continue;
      }
      pageId = inserted.id;
      console.log(`[${slug}] created page`);
    }

    const { data: existingVariant } = await supabase
      .from("content_page_variants")
      .select("id")
      .eq("page_id", pageId)
      .eq("locale", LOCALE)
      .eq("environment", ENVIRONMENT)
      .maybeSingle();

    if (existingVariant?.id) {
      const { error: updateErr } = await supabase
        .from("content_page_variants")
        .update({ body, updated_at: now })
        .eq("id", existingVariant.id);
      if (updateErr) {
        console.error(`[${slug}] failed to update variant:`, updateErr.message);
        continue;
      }
      console.log(`[${slug}] updated variant, blocks: ${body.blocks.length}`);
    } else {
      const { error: insertVarErr } = await supabase.from("content_page_variants").insert({
        page_id: pageId,
        locale: LOCALE,
        environment: ENVIRONMENT,
        body,
        updated_at: now,
      });
      if (insertVarErr) {
        console.error(`[${slug}] failed to create variant:`, insertVarErr.message);
        continue;
      }
      console.log(`[${slug}] created variant, blocks: ${body.blocks.length}`);
    }
  }

  console.log("Done. All overlay slugs seeded (nb/prod).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


