/**
 * Seed required CMS pages: home + app overlays.
 * Idempotent: upserts content_pages + content_page_variants (nb/prod).
 *
 * Run: npx tsx scripts/seedCmsHomeAndOverlays.ts
 * Requires: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and service role in env.
 */

import nextEnv from "@next/env";
import type { BlockList, BlockNode } from "../lib/cms/model/blockTypes";
import { supabaseAdmin } from "../lib/supabase/admin";
import { APP_OVERLAYS } from "../lib/cms/overlays/registry";
import { buildOverlayBodies } from "./seedAppOverlaysFromHardcoded";

const LOCALE = "nb";
const ENVIRONMENT = "prod";

type SeedPage = {
  slug: string;
  title: string;
  body: BlockList;
};

function block(id: string, type: string, data: Record<string, unknown>): BlockNode {
  return { id, type, data };
}

function buildHomeBody(): BlockList {
  return {
    version: 1,
    blocks: [
      block("seed-home-hero", "hero", {
        slot: "header",
        title: "Hjem",
        subtitle: "Forsideinnhold styrt fra CMS.",
      }),
      block("seed-home-intro", "richText", {
        slot: "help",
        heading: "Innholdsside for hjem",
        body: "Denne siden er opprettet som hjem i CMS. Rediger blokker her for å oppdatere forsiden.",
      }),
    ],
  };
}

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch (e) {
    console.error("Missing Supabase config (URL and service role in env).", e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const now = new Date().toISOString();

  const overlayBodies = buildOverlayBodies();

  const pages: SeedPage[] = [];

  // Home page
  pages.push({
    slug: "home",
    title: "Hjem",
    body: buildHomeBody(),
  });

  // Overlays: reuse bodies when available, otherwise create a minimal placeholder.
  for (const key of Object.keys(APP_OVERLAYS) as Array<keyof typeof APP_OVERLAYS>) {
    const entry = APP_OVERLAYS[key];
    const slug = entry.slug;
    const title = entry.title;
    const existingBody = overlayBodies[slug];

    const body: BlockList =
      existingBody && Array.isArray(existingBody.blocks) && existingBody.blocks.length > 0
        ? existingBody
        : {
            version: 1,
            blocks: [
              block(`seed-${slug}-header`, "hero", {
                slot: "header",
                title,
                subtitle: "CMS-overlay for app-side.",
              }),
            ],
          };

    pages.push({ slug, title, body });
  }

  for (const page of pages) {
    const { slug, title, body } = page;

    let pageId: string;
    const { data: existingPage, error: pageErr } = await supabase
      .from("content_pages")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (pageErr) {
      console.error(`[${slug}] failed to read page:`, pageErr.message);
      continue;
    }

    if (existingPage?.id) {
      const { error: updErr } = await supabase
        .from("content_pages")
        .update({ title, updated_at: now })
        .eq("id", existingPage.id);
      if (updErr) {
        console.error(`[${slug}] failed to update page:`, updErr.message);
        continue;
      }
      pageId = existingPage.id;
      console.log(`[${slug}] page updated`);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("content_pages")
        .insert({
          title,
          slug,
          status: "draft",
          updated_at: now,
        })
        .select("id")
        .single();
      if (insErr || !inserted?.id) {
        console.error(`[${slug}] failed to create page:`, insErr?.message ?? "no id");
        continue;
      }
      pageId = inserted.id;
      console.log(`[${slug}] page created`);
    }

    const { data: existingVariant, error: varErr } = await supabase
      .from("content_page_variants")
      .select("id")
      .eq("page_id", pageId)
      .eq("locale", LOCALE)
      .eq("environment", ENVIRONMENT)
      .maybeSingle();

    if (varErr) {
      console.error(`[${slug}] failed to read variant:`, varErr.message);
      continue;
    }

    if (existingVariant?.id) {
      const { error: updVarErr } = await supabase
        .from("content_page_variants")
        .update({ body, updated_at: now })
        .eq("id", existingVariant.id);
      if (updVarErr) {
        console.error(`[${slug}] failed to update variant:`, updVarErr.message);
        continue;
      }
      console.log(`[${slug}] variant updated, blocks: ${body.blocks.length}`);
    } else {
      const { error: insVarErr } = await supabase.from("content_page_variants").insert({
        page_id: pageId,
        locale: LOCALE,
        environment: ENVIRONMENT,
        body,
        updated_at: now,
      });
      if (insVarErr) {
        console.error(`[${slug}] failed to create variant:`, insVarErr.message);
        continue;
      }
      console.log(`[${slug}] variant created, blocks: ${body.blocks.length}`);
    }
  }

  console.log("Done. Home + overlay CMS pages ensured for nb/prod.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

