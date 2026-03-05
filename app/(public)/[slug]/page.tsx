import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { getContentBySlug } from "@/lib/cms/public/getContentBySlug";
import { renderBlock } from "@/lib/public/blocks/renderBlock";

const ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";
const LOCALE: "nb" | "en" = "nb";

type BlockItem = { id?: string; type?: string; data?: Record<string, unknown> };

function parseBody(body: unknown): BlockItem[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body as BlockItem[];
  if (typeof body === "object" && "blocks" in body && Array.isArray((body as { blocks: unknown }).blocks)) {
    return (body as { blocks: BlockItem[] }).blocks;
  }
  if (typeof body === "object" && "body" in body) return parseBody((body as { body: unknown }).body);
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = await getContentBySlug(slug);
  if (!content) return { title: "Siden finnes ikke" };
  const title = content.title?.trim() || "Lunchportalen";
  return {
    title: `${title} – Lunchportalen`,
    description: undefined,
    alternates: { canonical: `/${content.slug}` },
    robots: { index: true, follow: true },
  };
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
          <h1 className="mb-6 text-2xl font-semibold text-slate-900 md:text-3xl">
            {content.title}
          </h1>
        )}
        <div className="flex flex-col gap-6">
          {safeBlocks.map((block, i) => {
            const id = block?.id ?? `block-${i}`;
            const type = typeof block?.type === "string" ? block.type : "richText";
            const data = block?.data && typeof block.data === "object" ? block.data : {};
            return (
              <div key={id}>
                {renderBlock({ id, type, data }, ENV, LOCALE)}
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
