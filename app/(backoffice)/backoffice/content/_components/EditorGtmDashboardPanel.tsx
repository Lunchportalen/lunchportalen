"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { suggestControlledNextActions } from "@/lib/gtm/automation";
import { attributionSummary } from "@/lib/gtm/attribution";
import {
  appendGtmInteraction,
  emptyGtmCrmSnapshot,
  ensureGtmLeadInSnapshot,
  readGtmCrmFromLocalStorage,
  recordGtmConversion,
  setGtmLeadStatus,
  writeGtmCrmToLocalStorage,
} from "@/lib/gtm/crm";
import { computeGtmPipelineMetrics } from "@/lib/gtm/conversion";
import { attachEditorCampaignContext, campaignIdFromPageEditor } from "@/lib/gtm/integration";
import { emptyGtmLearning, learningTopMessages } from "@/lib/gtm/learning";
import type { GtmLearningSnapshot } from "@/lib/gtm/types";
import { mergeGtmLeadsWithOutbound } from "@/lib/gtm/mergeLeads";
import { buildGtmOutreachDrafts } from "@/lib/gtm/outreach";
import { resolveGtmObjectionPivot } from "@/lib/gtm/objectionHandler";
import { classifyGtmReply } from "@/lib/gtm/responses";
import { buildMailtoHref } from "@/lib/outbound/email";
import { readOutboundLeadsFromStorage } from "@/lib/outbound/storageLeads";

export type EditorGtmDashboardPanelProps = {
  enabled: boolean;
  pageId: string;
  pageTitle?: string;
};

export function EditorGtmDashboardPanel({ enabled, pageId, pageTitle }: EditorGtmDashboardPanelProps) {
  const [crm, setCrm] = useState(emptyGtmCrmSnapshot);
  const [learning, setLearning] = useState(emptyGtmLearning());
  const [syncNonce, setSyncNonce] = useState(0);
  const [productUrl, setProductUrl] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyPaste, setReplyPaste] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const fetchGtmLearningAggregate = useCallback(async (): Promise<GtmLearningSnapshot | null> => {
    const res = await fetch("/api/backoffice/ai/intelligence/events?aggregate=gtm", { credentials: "include" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { gtmLearning?: GtmLearningSnapshot } } | null;
    if (!json?.ok || !json.data?.gtmLearning) return null;
    return json.data.gtmLearning;
  }, []);

  const postIntelligenceEvent = useCallback(
    async (input: { type: "gtm" | "conversion"; payload: Record<string, unknown> }): Promise<GtmLearningSnapshot | null> => {
      const res = await fetch("/api/backoffice/ai/intelligence/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: input.type,
          source: "gtm_dashboard",
          payload: input.payload,
          pageId,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { gtmLearning?: GtmLearningSnapshot } } | null;
      if (!json?.ok) return null;
      return json.data?.gtmLearning ?? null;
    },
    [pageId],
  );

  const hydrate = useCallback(() => {
    setCrm(readGtmCrmFromLocalStorage());
    void fetchGtmLearningAggregate().then((snap) => {
      if (snap) setLearning(snap);
      else setLearning(emptyGtmLearning());
    });
    setSyncNonce((n) => n + 1);
  }, [fetchGtmLearningAggregate]);

  useEffect(() => {
    if (!enabled) return;
    void fetchGtmLearningAggregate().then((snap) => {
      if (snap) setLearning(snap);
    });
  }, [enabled, fetchGtmLearningAggregate]);

  const outbound = useMemo(() => {
    void syncNonce;
    return readOutboundLeadsFromStorage();
  }, [syncNonce]);

  const mergedLeads = useMemo(() => mergeGtmLeadsWithOutbound(outbound, crm), [outbound, crm]);

  const metrics = useMemo(() => computeGtmPipelineMetrics({ ...crm, leads: mergedLeads }), [crm, mergedLeads]);
  const attr = useMemo(() => attributionSummary(crm.attribution), [crm.attribution]);
  const suggestions = useMemo(() => suggestControlledNextActions(mergedLeads), [mergedLeads]);
  const topLearned = useMemo(() => learningTopMessages(learning, 4), [learning]);

  const persist = useCallback((next: typeof crm) => {
    setCrm(next);
    writeGtmCrmToLocalStorage(next);
  }, []);

  const selected = mergedLeads.find((l) => l.id === selectedId) ?? null;

  const drafts = useMemo(() => {
    if (!selected) return null;
    const withCamp = attachEditorCampaignContext(selected, pageId, pageTitle);
    return buildGtmOutreachDrafts(withCamp, productUrl);
  }, [selected, pageId, pageTitle, productUrl]);

  const classification = useMemo(() => (replyPaste.trim() ? classifyGtmReply(replyPaste) : null), [replyPaste]);

  const pivot = useMemo(() => {
    if (!selected || !replyPaste.trim()) return null;
    return resolveGtmObjectionPivot(replyPaste, attachEditorCampaignContext(selected, pageId, pageTitle), {
      pivotAlreadyUsed: false,
      preferEnterpriseLine: true,
    });
  }, [replyPaste, selected, pageId, pageTitle]);

  if (!enabled) return null;

  return (
    <section aria-label="GTM Dashboard" className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GTM Dashboard</p>
      <p className="mt-2 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Spor leads, pipeline og omsetning lokalt (CRM-lag). GTM-læring lagres i sentral intelligens (API + database), ikke i nettleseren.
        Ingen automatisk utsending — godkjenn alltid selv. Koblet til Outbound-listen og{" "}
        <code className="text-[10px]">lib/outbound/objections</code>.
      </p>
      <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
        Kampanje (denne siden): <span className="font-mono">{campaignIdFromPageEditor(pageId, pageTitle)}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => hydrate()}
          className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium hover:bg-slate-50"
        >
          Synkroniser
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div className="rounded-lg border border-[rgb(var(--lp-border))] p-2">
          <div className="text-[rgb(var(--lp-muted))]">Leads</div>
          <div className="text-lg font-semibold">{metrics.leadsTotal}</div>
        </div>
        <div className="rounded-lg border border-[rgb(var(--lp-border))] p-2">
          <div className="text-[rgb(var(--lp-muted))]">Interesse + deal-rate</div>
          <div className="text-lg font-semibold">{(metrics.conversionRateInterested * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-[rgb(var(--lp-border))] p-2">
          <div className="text-[rgb(var(--lp-muted))]">Møter</div>
          <div className="text-lg font-semibold">{metrics.meetingsBooked}</div>
        </div>
        <div className="rounded-lg border border-[rgb(var(--lp-border))] p-2">
          <div className="text-[rgb(var(--lp-muted))]">Omsetning (NOK)</div>
          <div className="text-lg font-semibold">{metrics.revenueNok.toLocaleString("nb-NO")}</div>
        </div>
      </div>

      {topLearned.length > 0 ? (
        <div className="mt-3 text-[10px] text-[rgb(var(--lp-muted))]">
          <span className="font-semibold text-[rgb(var(--lp-text))]">Læring (topp kanaler): </span>
          {topLearned.map((r) => `${r.key} ${(r.rate * 100).toFixed(0)}%`).join(" · ")}
        </div>
      ) : null}

      {Object.keys(attr.byCampaign).length > 0 ? (
        <div className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
          <span className="font-semibold text-[rgb(var(--lp-text))]">Attributjon: </span>
          {Object.entries(attr.byCampaign)
            .map(([k, v]) => `${k}: ${v.leads} leads / ${v.revenueNok} NOK`)
            .join(" · ")}
        </div>
      ) : null}

      <label className="mt-3 block text-[11px] text-[rgb(var(--lp-muted))]">
        Produktlenke (utkast)
        <input
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-[rgb(var(--lp-border))] px-2 py-1.5 text-sm"
          placeholder="https://…"
        />
      </label>

      <div className="mt-3 max-h-40 overflow-auto rounded-md border border-[rgb(var(--lp-border))]">
        <table className="w-full text-left text-[10px]">
          <thead className="sticky top-0 bg-slate-50 text-[rgb(var(--lp-muted))]">
            <tr>
              <th className="p-2">Selskap</th>
              <th className="p-2">Score</th>
              <th className="p-2">Status</th>
              <th className="p-2">Kilde</th>
            </tr>
          </thead>
          <tbody>
            {mergedLeads.map((l) => (
              <tr
                key={l.id}
                className={selectedId === l.id ? "bg-pink-50" : ""}
                onClick={() => setSelectedId(l.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedId(l.id);
                }}
                tabIndex={0}
                role="button"
              >
                <td className="p-2 font-medium">{l.company.name}</td>
                <td className="p-2">{l.score}</td>
                <td className="p-2">{l.status}</td>
                <td className="p-2">{l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {suggestions.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[10px] text-[rgb(var(--lp-muted))]">
          <li className="font-semibold text-[rgb(var(--lp-text))]">Foreslåtte neste steg (kontrollert)</li>
          {suggestions.slice(0, 6).map((s) => (
            <li key={`${s.leadId}-${s.title}`}>
              <button type="button" className="text-left underline" onClick={() => setSelectedId(s.leadId)}>
                {s.title}
              </button>
              {" — "}
              {s.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {selected && drafts ? (
        <div className="mt-3 space-y-2 rounded-lg border border-dashed border-slate-200 p-2 text-[11px]">
          <div className="font-semibold">{selected.company.name}</div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white"
              href={buildMailtoHref(selected.contact.email, drafts.email.subject, drafts.email.body)}
            >
              Åpne e-postutkast (mailto)
            </a>
            <button
              type="button"
              className="rounded-md border border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(drafts.linkedin);
                setToast("LinkedIn-utkast kopiert.");
                setTimeout(() => setToast(null), 2500);
              }}
            >
              Kopier LinkedIn
            </button>
            <button
              type="button"
              className="rounded-md border border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(drafts.followUp);
                setToast("Oppfølging kopiert.");
                setTimeout(() => setToast(null), 2500);
              }}
            >
              Kopier oppfølging
            </button>
          </div>
          <p className="text-[10px] text-[rgb(var(--lp-muted))]">Loggfør utkast (ingen send):</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs underline"
              onClick={() => {
                const base = attachEditorCampaignContext(selected, pageId, pageTitle);
                let next = ensureGtmLeadInSnapshot(crm, base);
                next = appendGtmInteraction(next, selected.id, {
                  channel: "email",
                  summary: "E-postutkast forberedt (GTM-dashboard)",
                  metadata: { templateKey: drafts.templateKey },
                });
                next = setGtmLeadStatus(next, selected.id, "contacted");
                persist(next);
                void postIntelligenceEvent({
                  type: "gtm",
                  payload: {
                    kind: "outreach_sent",
                    channel: "email",
                    leadId: selected.id,
                    templateKey: drafts.templateKey,
                    campaignId: campaignIdFromPageEditor(pageId, pageTitle),
                  },
                });
                setToast("Logget + status «contacted».");
                setTimeout(() => setToast(null), 2500);
              }}
            >
              Logg e-postutkast
            </button>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => {
                const base = attachEditorCampaignContext(selected, pageId, pageTitle);
                let next = ensureGtmLeadInSnapshot(crm, base);
                next = appendGtmInteraction(next, selected.id, {
                  channel: "linkedin",
                  summary: "LinkedIn-utkast forberedt (GTM-dashboard)",
                  metadata: { templateKey: drafts.templateKey },
                });
                persist(next);
                void postIntelligenceEvent({
                  type: "gtm",
                  payload: {
                    kind: "outreach_sent",
                    channel: "linkedin",
                    leadId: selected.id,
                    templateKey: drafts.templateKey,
                    campaignId: campaignIdFromPageEditor(pageId, pageTitle),
                  },
                });
              }}
            >
              Logg LinkedIn-utkast
            </button>
          </div>
        </div>
      ) : null}

      <label className="mt-3 block text-[11px] text-[rgb(var(--lp-muted))]">
        Lim inn svar (klassifisering)
        <textarea
          value={replyPaste}
          onChange={(e) => setReplyPaste(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-[rgb(var(--lp-border))] px-2 py-1.5 text-sm"
        />
      </label>
      {classification ? (
        <p className="text-[11px] text-[rgb(var(--lp-text))]">
          Klasse: <strong>{classification.kind}</strong> ({Math.round(classification.confidence * 100)}%)
        </p>
      ) : null}
      {pivot?.message ? (
        <div className="mt-2 rounded-md bg-slate-50 p-2 text-[11px] whitespace-pre-wrap">{pivot.message}</div>
      ) : null}
      {selected && classification ? (
        <button
          type="button"
          className="mt-2 text-xs underline"
          onClick={() => {
            const lead = attachEditorCampaignContext(selected, pageId, pageTitle);
            void postIntelligenceEvent({
              type: "gtm",
              payload: {
                kind: "gtm_outcome",
                lead,
                templateKey: drafts?.templateKey ?? "unknown",
                channel: "email",
                classification,
              },
            }).then((snap) => {
              if (snap) setLearning(snap);
              setToast("Læring oppdatert (sentral lagring).");
              setTimeout(() => setToast(null), 2500);
            });
          }}
        >
          Registrer utfall i læringslag
        </button>
      ) : null}

      {selected ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <button
            type="button"
            className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
            onClick={() => {
              const base = attachEditorCampaignContext(selected, pageId, pageTitle);
              persist(setGtmLeadStatus(ensureGtmLeadInSnapshot(crm, base), selected.id, "interested"));
            }}
          >
            Marker interessert
          </button>
          <button
            type="button"
            className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
            onClick={() => persist(setGtmLeadStatus(crm, selected.id, "closed"))}
          >
            Lukk
          </button>
          <button
            type="button"
            className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
            onClick={() => {
              const base = attachEditorCampaignContext(selected, pageId, pageTitle);
              let next = ensureGtmLeadInSnapshot(crm, base);
              next = recordGtmConversion(next, {
                leadId: selected.id,
                kind: "meeting_booked",
                campaignId: campaignIdFromPageEditor(pageId, pageTitle),
              });
              persist(setGtmLeadStatus(next, selected.id, "interested"));
              void postIntelligenceEvent({
                type: "conversion",
                payload: {
                  kind: "gtm_conversion",
                  conversionKind: "meeting_booked",
                  leadId: selected.id,
                  campaignId: campaignIdFromPageEditor(pageId, pageTitle),
                  companyName: selected.company.name,
                },
              });
            }}
          >
            Logg møte
          </button>
          <label className="flex items-center gap-1">
            NOK
            <input
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              className="w-20 rounded border border-[rgb(var(--lp-border))] px-1 text-xs"
            />
          </label>
          <button
            type="button"
            className="rounded bg-slate-900 px-2 py-1 text-white"
            onClick={() => {
              const n = Number(dealValue.replace(/\s/g, "").replace(",", "."));
              const v = Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
              const base = attachEditorCampaignContext(selected, pageId, pageTitle);
              let next = ensureGtmLeadInSnapshot(crm, base);
              next = recordGtmConversion(next, {
                leadId: selected.id,
                kind: "deal_closed",
                valueNok: v,
                campaignId: campaignIdFromPageEditor(pageId, pageTitle),
              });
              persist(setGtmLeadStatus(next, selected.id, "closed"));
              setDealValue("");
              void postIntelligenceEvent({
                type: "conversion",
                payload: {
                  kind: "gtm_conversion",
                  conversionKind: "deal_closed",
                  leadId: selected.id,
                  valueNok: v,
                  campaignId: campaignIdFromPageEditor(pageId, pageTitle),
                  companyName: selected.company.name,
                },
              });
            }}
          >
            Logg deal
          </button>
        </div>
      ) : null}

      {toast ? <p className="mt-2 text-xs text-green-800">{toast}</p> : null}
    </section>
  );
}
