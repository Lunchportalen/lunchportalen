import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const keys = [
  "hero_bleed",
  "hero_split",
  "hero_minimal",
  "hero_centered",
  "hero_video",
  "banner",
  "promo_strip",
  "cta_block",
  "cta_split",
  "newsletter_signup",
  "alert_bar",
  "text_block",
  "rich_text",
  "quote_block",
  "highlight_block",
  "steps_block",
  "timeline_block",
  "stats_block",
  "code_block",
  "image_block",
  "image_gallery",
  "split_block",
  "grid_2",
  "grid_3",
  "feature_grid",
  "card_grid",
  "zigzag_block",
  "section_divider",
  "testimonial_block",
  "logo_cloud",
  "faq_block",
  "pricing_table",
  "comparison_table",
  "case_study_block",
  "team_block",
  "product_list",
  "article_list",
  "search_results",
  "category_grid",
  "menu_list",
  "order_summary",
  "dynamic_feed",
  "form_embed",
  "related_links",
];

function pascal(s) {
  return s.split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}

const dir = path.join(root, "components", "blocks", "enterpriseRegistry");

for (const k of keys) {
  const name = `Registry${pascal(k)}Block`;
  const content = `"use client";

import { createRegistryBlock } from "@/components/blocks/EnterpriseLockedBlockView";

/** Enterprise CMS registry block: block.type \`${k}\` */
export const ${name} = createRegistryBlock("${k}");
`;
  fs.writeFileSync(path.join(dir, `${name}.tsx`), content, "utf8");
}

const barrel =
  keys
    .map((k) => {
      const name = `Registry${pascal(k)}Block`;
      return `export { ${name} } from "./${name}";`;
    })
    .join("\n") + "\n";

fs.writeFileSync(path.join(dir, "allRegistryBlocks.tsx"), barrel, "utf8");
console.log("wrote", keys.length + 1, "files under enterpriseRegistry");
