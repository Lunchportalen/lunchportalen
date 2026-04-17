"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchContentTreeEnvelope } from "../_tree/fetchContentTree";
import { isContentPageUuid } from "../_tree/treeIds";
import type { ContentTreeNode } from "../_tree/treeTypes";

const BASE = "/backoffice/content";

function pickFirstPageIdFromRoots(nodes: ContentTreeNode[]): string | null {
  for (const n of nodes) {
    if (isContentPageUuid(n.id)) return n.id;
    if (n.targetPageId && isContentPageUuid(n.targetPageId)) return n.targetPageId;
    if (n.children?.length) {
      const inner = pickFirstPageIdFromRoots(n.children);
      if (inner) return inner;
    }
  }
  return null;
}

/**
 * `/backoffice/content` uten [id]: ingen tom/velg-state — første gyldige side eller Hjem-API, deretter `replace` til editor.
 */
export default function ContentRootAutoEnter() {
  const router = useRouter();
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tree = await fetchContentTreeEnvelope();
      if (cancelled) return;
      if (!tree.ok) {
        if (!cancelled) {
          setFatal("message" in tree ? (tree.message ?? "Kunne ikke laste innhold.") : "Kunne ikke laste innhold.");
        }
        return;
      }

      let id = pickFirstPageIdFromRoots(tree.envelope.roots);
      if (!id) {
        try {
          const res = await fetch("/api/backoffice/content/home", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          const body = (await res.json()) as {
            ok?: boolean;
            data?: { page?: { id?: string } };
            message?: string;
            error?: string;
          };
          const pageId = body?.data?.page?.id;
          if (res.ok && pageId && typeof pageId === "string") {
            id = pageId;
          }
        } catch {
          // fall through to slug bootstrap
        }
      }

      if (cancelled) return;
      if (id) {
        router.replace(`${BASE}/${id}`);
        return;
      }
      router.replace(`${BASE}/home`);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (fatal) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4" role="alert">
        <p className="text-center text-sm text-red-800">{fatal}</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[50vh] flex-1 items-center justify-center bg-[rgb(var(--lp-bg))]"
      aria-busy="true"
      aria-label="Åpner redigeringsvisning"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );
}
