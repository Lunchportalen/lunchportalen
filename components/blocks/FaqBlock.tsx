import React from "react";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";

export type FaqItem = { id: string; question: string; answer: string };

export type FaqBlockProps = {
  merged: MergedDesign;
  sectionTitle: string;
  items: FaqItem[];
};

/**
 * Locked FAQ presentation (native `<details>` — no client JS required).
 * Opt-in from `zigzag` via `data.presentation === "faq"` when mapping steps to Q/A.
 */
export function FaqBlock({ merged, sectionTitle, items }: FaqBlockProps) {
  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      <div className="lp-section-head text-center">
        <h2 className={mergedHeadingClassString(merged, "h2")}>{sectionTitle}</h2>
      </div>
      <div className="mx-auto mt-6 max-w-3xl space-y-2">
        {items.map((item) => (
          <details
            key={item.id}
            className="group rounded-2xl border border-[rgba(var(--lp-border),0.85)] bg-[rgb(var(--lp-card))]/80 px-4 py-2"
          >
            <summary className="cursor-pointer list-none py-3 font-medium text-[rgb(var(--lp-text))] marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                <span>{item.question}</span>
                <span className="text-[rgb(var(--lp-muted))] text-sm transition group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </span>
            </summary>
            <div className="border-t border-[rgba(var(--lp-border),0.5)] pt-3 pb-2">
              <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{item.answer}</TextBlock>
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}
