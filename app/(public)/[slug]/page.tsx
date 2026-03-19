import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";
import { getContentBySlug } from "@/lib/cms/public/getContentBySlug";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import { parseBody } from "@/lib/cms/public/parseBody";
import { renderBlock } from "@/lib/public/blocks/renderBlock";

const ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";
const LOCALE: "nb" | "en" = "nb";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = await getContentBySlug(slug);
  if (!content) return { title: "Siden finnes ikke" };
  return buildCmsPageMetadata({
    pageTitle: content.title ?? null,
    slug: content.slug ?? slug,
    body: content.body,
  });
}

export default async function PublicCmsPage({ params }: Props) {
  const { slug } = await params;
  const content = await getContentBySlug(slug);
  if (!content) notFound();

  const blocks = parseBody(content.body);
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  return (
    <PageShell>
      <article className="lp-container mx-auto max-w-4xl px-4 py-8">
        {content.title && (
          <h1 className="lp-h1 mb-6 text-[rgb(var(--lp-text))]">
            {content.title}
          </h1>
        )}
        <div className="flex flex-col gap-6">
          {safeBlocks.map((block, i) => {
            const node = normalizeBlockForRender(block ?? null, i);
            return (
              <div key={node.id}>
                {renderBlock(node, ENV, LOCALE)}
              </div>
            );
          })}
        </div>
        {safeBlocks.length === 0 && (
          <p className="text-slate-500">Ingen innhold å vise.</p>
        )}
      </article>
    </PageShell>
  );
}
