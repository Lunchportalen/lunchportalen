"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { useBellissimaSectionWorkspacePublisher } from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import { ToastProvider } from "@/components/ui/toast";
import {
  buildContentSectionBellissimaWorkspaceSnapshot,
  type BuildContentSectionBellissimaWorkspaceSnapshotInput,
  type ContentBellissimaActionHandlerMap,
} from "@/lib/cms/backofficeWorkspaceContextModel";
import SectionShell from "../../_shell/SectionShell";
import ContentTree from "../_tree/ContentTree";

type ContentWorkspaceHostProps = {
  children?: ReactNode;
  selectedNodeId?: string;
};

type SectionSidebarContent = {
  key: string;
  node: ReactNode;
} | null;

type SectionWorkspaceRegistration = {
  key: string;
  snapshotInput: BuildContentSectionBellissimaWorkspaceSnapshotInput;
  actionHandlers?: ContentBellissimaActionHandlerMap;
} | null;

const SectionSidebarContext = createContext<((content: SectionSidebarContent) => void) | null>(
  null,
);
const SectionWorkspaceRegistrationContext = createContext<
  ((content: SectionWorkspaceRegistration) => void) | null
>(null);

export function useSectionSidebarContent() {
  return useContext(SectionSidebarContext);
}

export function useSectionWorkspaceRegistration() {
  return useContext(SectionWorkspaceRegistrationContext);
}

/**
 * U32 — canonical content workspace host:
 * section -> tree -> child route, shared Bellissima context, no workspace surface ownership.
 */
export default function ContentWorkspaceHost({
  children,
  selectedNodeId: initialNodeId,
}: ContentWorkspaceHostProps) {
  const pathname = usePathname() ?? "";
  const publishBellissima = useBellissimaSectionWorkspacePublisher();
  const routeState = useMemo(() => resolveBackofficeContentRoute(pathname), [pathname]);
  const [sectionSidebarContent, setSectionSidebarContent] = useState<SectionSidebarContent>(
    null,
  );
  const [sectionWorkspaceRegistration, setSectionWorkspaceRegistration] =
    useState<SectionWorkspaceRegistration>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialNodeId ?? null,
  );
  const routeEntityId = routeState.entityId;

  useEffect(() => {
    if (routeEntityId) {
      setSelectedNodeId(routeEntityId);
      return;
    }
    if (initialNodeId) {
      setSelectedNodeId(initialNodeId);
      return;
    }
    if (routeState.isSectionView) {
      setSelectedNodeId(null);
    }
  }, [initialNodeId, routeEntityId, routeState.isSectionView]);

  const setSectionSidebarContentStable = useCallback((next: SectionSidebarContent) => {
    setSectionSidebarContent((prev) => {
      if (next == null) {
        if (prev == null) return prev;
        return null;
      }
      if (prev?.key === next.key) return prev;
      return next;
    });
  }, []);
  const setSectionWorkspaceRegistrationStable = useCallback(
    (next: SectionWorkspaceRegistration) => {
      setSectionWorkspaceRegistration((prev) => {
        if (next == null) {
          if (prev == null) return prev;
          return null;
        }
        if (prev?.key === next.key) return next;
        return next;
      });
    },
    [],
  );

  const hostSnapshot = useMemo(() => {
    if (routeEntityId) return null;
    if (routeState.kind === "overview") {
      const overviewRegistration =
        sectionWorkspaceRegistration?.snapshotInput.viewId === "overview"
          ? sectionWorkspaceRegistration.snapshotInput
          : null;
      return buildContentSectionBellissimaWorkspaceSnapshot(
        overviewRegistration ?? {
          viewId: "overview",
          title: "Innhold",
          subtitle:
            "Tree-first landing for opprettelse, arbeidskø og trygg routing videre inn i detalj-workspaces.",
          primaryActionIds: ["create"],
          secondaryActionIds: ["settings"],
          actionAvailability: { create: true, settings: true },
        },
      );
    }
    if (routeState.kind === "growth") {
      return buildContentSectionBellissimaWorkspaceSnapshot({
        viewId: "growth",
        title: "Vekst & innsikt",
        subtitle:
          "Sekundær content-workspace for analyse, simulering og trygg vurdering av flere sider.",
      });
    }
    if (routeState.kind === "recycle-bin") {
      return buildContentSectionBellissimaWorkspaceSnapshot({
        viewId: "recycle-bin",
        title: "Papirkurv",
        subtitle:
          "Livssyklusflate for slettet innhold. Ingen parallelle editorer monteres her.",
      });
    }
    return null;
  }, [routeEntityId, routeState.kind, sectionWorkspaceRegistration]);
  const hostActionHandlers = useMemo(() => {
    if (routeState.kind !== "overview") return undefined;
    return sectionWorkspaceRegistration?.actionHandlers;
  }, [routeState.kind, sectionWorkspaceRegistration]);

  useEffect(() => {
    if (!hostSnapshot) {
      publishBellissima(null);
      return;
    }
    publishBellissima(
      hostSnapshot,
      hostActionHandlers && Object.keys(hostActionHandlers).length > 0
        ? { actionHandlers: hostActionHandlers }
        : undefined,
    );
    return () => {
      publishBellissima(null);
    };
  }, [hostActionHandlers, hostSnapshot, publishBellissima]);

  /** URL must not override explicit tree selection until navigation completes (U97F post-create reveal). */
  const effectiveSelectedNodeId = selectedNodeId ?? routeEntityId;

  return (
    <ToastProvider>
      <SectionWorkspaceRegistrationContext.Provider value={setSectionWorkspaceRegistrationStable}>
        <SectionSidebarContext.Provider value={setSectionSidebarContentStable}>
          <SectionShell
            flattenContentDetailSurface={routeState.kind === "detail"}
            treeSlot={
              <div className="flex h-full flex-col overflow-y-auto">
                <ContentTree
                  selectedNodeId={effectiveSelectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
                {sectionSidebarContent?.node ?? null}
              </div>
            }
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
          </SectionShell>
        </SectionSidebarContext.Provider>
      </SectionWorkspaceRegistrationContext.Provider>
    </ToastProvider>
  );
}
