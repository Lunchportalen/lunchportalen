"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { learnGrowthFromPosts } from "@/lib/growth/growthLearning";
import { readCalendarPostsFromLocalStorage } from "@/lib/social/calendarBrowserStorage";
import { createOutboundLead, type OutboundLead } from "@/lib/outbound/lead";
import { parseOutboundCsv } from "@/lib/outbound/csvImport";
import { generateColdEmail, buildMailtoHref } from "@/lib/outbound/email";
import { generateLinkedInMessage } from "@/lib/outbound/linkedin";
import { hashOutboundBody } from "@/lib/outbound/hash";
import {
  OUTBOUND_MAX_EMAIL_PER_DAY,
  OUTBOUND_MAX_LINKEDIN_PER_DAY,
  checkOutboundQuota,
  recordOutboundApprovedSend,
} from "@/lib/outbound/quota";
import { countSentToday } from "@/lib/outbound/sentLog";
import { generateCateringColdEmail, generateCateringLinkedInMessage } from "@/lib/outbound/cateringCopy";
import { runFollowUps } from "@/lib/outbound/followupEngine";
import { scheduleFollowUp } from "@/lib/outbound/followup";
import { addFollowUp, completeFollowUpForLead, getPendingFollowUps } from "@/lib/outbound/followupStore";
import { formatDateTimeNO } from "@/lib/date/format";
import {
  applyCateringPivotOnce,
  closeConversation,
  getLeadConversation,
  resetLeadConversation,
  shouldUseLunchProductCopy,
} from "@/lib/outbound/conversationStorage";
import { detectObjection, type OutboundObjectionId } from "@/lib/outbound/objections";
import {
  getOutboundObjectionSnapshot,
  recordCateringConversionLogged,
  recordOutboundReplyAnalysis,
  recordPivotApplied,
} from "@/lib/outbound/objectionMetrics";
import { isHighValueLead } from "@/lib/outbound/leadValue";
import { handleObjection } from "@/lib/outbound/responses";
import {
  buildCrmLeadFromInterestedOutbound,
  logReply,
  type OutboundReplyStatus,
} from "@/lib/outbound/replies";
import { rankOutboundLeads } from "@/lib/outbound/rankLeads";
import {
  readOutboundLeadsFromStorage,
  writeOutboundLeadsToStorage,
} from "@/lib/outbound/storageLeads";
import type { Lead } from "@/lib/leads/types";

export type OutboundPanelProps = {
  pageId: string;
  /** Standard produkt-/kampanjelenke i e-post */
  defaultProductUrl?: string;
};

type DraftState = {
  subject: string;
  body: string;
  linkedin: string;
};

export function OutboundPanel(props: OutboundPanelProps) {
  const { pageId, defaultProductUrl = "" } = props;
  const [leads, setLeads] = useState<OutboundLead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState(defaultProductUrl);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "approved" | "rejected">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [crmPreview, setCrmPreview] = useState<Lead | null>(null);
  const [replyPaste, setReplyPaste] = useState("");
  const [objectionSuggestion, setObjectionSuggestion] = useState<string | null>(null);
  const [lastDetectedObjection, setLastDetectedObjection] = useState<OutboundObjectionId | null>(null);
  const [conversationRev, setConversationRev] = useState(0);
  const [followUpRev, setFollowUpRev] = useState(0);

  const [manual, setManual] = useState({
    companyName: "",
    industry: "office",
    role: "office",
    contactName: "",
    email: "",
    linkedinUrl: "",
    companySize: "",
  });

  const growthHint = useMemo(() => {
    const posts = readCalendarPostsFromLocalStorage(pageId || "default");
    const g = learnGrowthFromPosts(posts);
    return g.industriesByRevenue;
  }, [pageId]);

  const objectionSnap = useMemo(() => {
    if (typeof window === "undefined") {
      return { pctCanteenOfAnalyses: 0, pctCateringOfCanteen: 0, analysisRuns: 0 };
    }
    return getOutboundObjectionSnapshot();
  }, [pageId, conversationRev, followUpRev]);

  const dueFollowUps = useMemo(() => runFollowUps(leads), [leads, followUpRev]);
  const pendingFollowUps = useMemo(() => getPendingFollowUps(), [followUpRev]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fn = () => setFollowUpRev((n) => n + 1);
    window.addEventListener("lp-outbound-followup", fn);
    return () => window.removeEventListener("lp-outbound-followup", fn);
  }, []);

  const ranked = useMemo(() => rankOutboundLeads(leads, { industriesByRevenue: growthHint }), [leads, growthHint]);

  const selected = useMemo(
    () => ranked.find((l) => l.id === selectedId) ?? null,
    [ranked, selectedId],
  );

  const conversation = useMemo(() => {
    if (!selectedId) return null;
    return getLeadConversation(selectedId);
  }, [selectedId, conversationRev]);

  useEffect(() => {
    setLeads(readOutboundLeadsFromStorage());
    setHydrated(true);
    if (defaultProductUrl) {
      setProductUrl(defaultProductUrl);
    } else if (typeof window !== "undefined") {
      setProductUrl((u) => (u ? u : `${window.location.origin}/`));
    }
  }, [pageId, defaultProductUrl]);

  const persist = useCallback((next: OutboundLead[]) => {
    setLeads(next);
    writeOutboundLeadsToStorage(next);
  }, []);

  const bumpToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 6000);
  }, []);

  const onGenerateDrafts = useCallback(() => {
    if (!selected) return;
    const conv = getLeadConversation(selected.id);
    if (conv.state === "closed") {
      bumpToast("Samtale er avsluttet for denne kontakten. Nullstill status for å starte på nytt.");
      return;
    }
    if (shouldUseLunchProductCopy(selected.id)) {
      const email = generateColdEmail(selected, productUrl);
      const li = generateLinkedInMessage(selected);
      setDraft({ subject: email.subject, body: email.body, linkedin: li });
    } else if (conv.state === "catering_pitch") {
      const email = generateCateringColdEmail(selected);
      const li = generateCateringLinkedInMessage(selected);
      setDraft({ subject: email.subject, body: email.body, linkedin: li });
    } else {
      bumpToast("Kan ikke generere utkast i denne tilstanden.");
      return;
    }
    setApprovalStatus("idle");
    setCrmPreview(null);
  }, [selected, productUrl, bumpToast]);

  const onApprove = useCallback(() => {
    if (!draft) {
      bumpToast("Generer utkast først.");
      return;
    }
    setApprovalStatus("approved");
    bumpToast("Godkjent — bruk knappene under for manuell utsending (ingen auto-LinkedIn).");
  }, [draft, bumpToast]);

  const onReject = useCallback(() => {
    setApprovalStatus("rejected");
    setDraft(null);
    bumpToast("Avvist — velg ny kontakt eller generer på nytt.");
  }, [bumpToast]);

  const onLogEmailSent = useCallback(() => {
    if (!selected || !draft) return;
    const hash = hashOutboundBody(`${draft.subject}|${draft.body}`);
    const r = recordOutboundApprovedSend(selected.id, "email", hash);
    if (r.ok === false) {
      bumpToast(r.reason);
      return;
    }
    bumpToast("E-post loggført for i dag (manuell utsending).");
  }, [selected, draft, bumpToast]);

  const onLogLinkedInSent = useCallback(() => {
    if (!selected || !draft) return;
    const hash = hashOutboundBody(draft.linkedin);
    const r = recordOutboundApprovedSend(selected.id, "linkedin", hash);
    if (r.ok === false) {
      bumpToast(r.reason);
      return;
    }
    bumpToast("LinkedIn-forslag loggført for i dag.");
  }, [selected, draft, bumpToast]);

  const onCopyLinkedIn = useCallback(async () => {
    if (!draft?.linkedin) return;
    try {
      await navigator.clipboard.writeText(draft.linkedin);
      bumpToast("LinkedIn-tekst kopiert.");
    } catch {
      bumpToast("Kopiering feilet — merk teksten manuelt.");
    }
  }, [draft, bumpToast]);

  const onOpenLinkedIn = useCallback(() => {
    const u = selected?.linkedinUrl?.trim();
    if (!u) {
      bumpToast("Ingen linkedinUrl på lead — lim inn profil-URL i lista.");
      return;
    }
    window.open(u.startsWith("http") ? u : `https://${u}`, "_blank", "noopener,noreferrer");
  }, [selected, bumpToast]);

  const onReply = useCallback(
    (status: OutboundReplyStatus) => {
      if (!selected) return;
      logReply({
        leadId: selected.id,
        status,
        industry: selected.industry,
        role: selected.role,
      });
      if (status === "interested_catering") {
        recordCateringConversionLogged();
        const lead = buildCrmLeadFromInterestedOutbound({
          leadId: selected.id,
          companyName: selected.companyName,
          industry: selected.industry,
          role: selected.role,
          companySize: selected.companySize != null ? String(selected.companySize) : undefined,
          productIntent: "catering",
        });
        setCrmPreview(lead);
        bumpToast("Catering-interesse loggført. CRM-lead er merket Melhus/catering.");
      } else if (status === "interested") {
        const lead = buildCrmLeadFromInterestedOutbound({
          leadId: selected.id,
          companyName: selected.companyName,
          industry: selected.industry,
          role: selected.role,
          companySize: selected.companySize != null ? String(selected.companySize) : undefined,
          productIntent: "lunch",
        });
        setCrmPreview(lead);
        bumpToast("Interesse loggført. CRM-lead er klart (kopier eller send via godkjent CRM-kall).");
      } else {
        setCrmPreview(null);
        if (status === "not_interested") {
          closeConversation(selected.id);
          setConversationRev((n) => n + 1);
        }
        bumpToast("Svar loggført.");
      }
    },
    [selected, bumpToast],
  );

  const onAnalyzeReply = useCallback(() => {
    if (!selected) return;
    const raw = replyPaste.trim();
    if (!raw) {
      bumpToast("Lim inn svar fra lead først.");
      return;
    }
    const detected = detectObjection(raw);
    setLastDetectedObjection(detected);
    recordOutboundReplyAnalysis(detected);
    const conv = getLeadConversation(selected.id);
    const text = detected ? handleObjection(detected, selected, { pivotAlreadyUsed: conv.pivotUsed }) : null;
    setObjectionSuggestion(text);
    if (!detected) {
      bumpToast("Ingen kjent innvending — vurder manuelt svar.");
    } else if (!text) {
      bumpToast("Pivot er allerede brukt for denne kontakten (maks én auto-pivot).");
    } else {
      let msg =
        "Innvending registrert — se forslag under. Bekreft pivot før nye utkast går til catering.";
      const when =
        detected === "has_canteen" && isHighValueLead(selected)
          ? scheduleFollowUp(selected, "has_canteen")
          : null;
      const fr = when != null ? addFollowUp(selected.id, when, "has_canteen") : null;
      if (fr?.ok === true) {
        msg += " Oppfølging planlagt (én per lead, min. 30 døgn, standard 60 døgn).";
        setFollowUpRev((n) => n + 1);
      } else if (fr?.ok === false) {
        msg += ` (${fr.reason})`;
      }
      bumpToast(msg);
    }
  }, [selected, replyPaste, bumpToast]);

  const onConfirmPivot = useCallback(() => {
    if (!selected) return;
    const detected = lastDetectedObjection;
    if (detected !== "has_canteen") {
      bumpToast("Kjør analyse med kantine-innvending først.");
      return;
    }
    const ok = applyCateringPivotOnce(selected.id, detected);
    if (!ok) {
      bumpToast("Pivot finnes allerede.");
      return;
    }
    recordPivotApplied(detected);
    setConversationRev((n) => n + 1);
    bumpToast("Pivot bekreftet: nye utkast bruker catering (ikke lunsj-abonnement).");
  }, [selected, lastDetectedObjection, bumpToast]);

  const onCopyObjectionSuggestion = useCallback(async () => {
    if (!objectionSuggestion) return;
    try {
      await navigator.clipboard.writeText(objectionSuggestion);
      bumpToast("Forslag kopiert — lim inn manuelt i LinkedIn/e-post.");
    } catch {
      bumpToast("Kopiering feilet.");
    }
  }, [objectionSuggestion, bumpToast]);

  const onAddManual = useCallback(() => {
    const sz = parseInt(manual.companySize, 10);
    const lead = createOutboundLead({
      companyName: manual.companyName,
      industry: manual.industry || "office",
      role: manual.role || "office",
      contactName: manual.contactName || undefined,
      email: manual.email || undefined,
      linkedinUrl: manual.linkedinUrl || undefined,
      companySize: Number.isFinite(sz) ? sz : undefined,
    });
    persist([...leads, lead]);
    setSelectedId(lead.id);
    bumpToast("Lead lagt til (kun lokalt).");
  }, [manual, leads, persist, bumpToast]);

  const onCsv = useCallback(
    (text: string) => {
      const { leads: imported, errors } = parseOutboundCsv(text);
      if (errors.length && imported.length === 0) {
        bumpToast(errors.join(" "));
        return;
      }
      persist([...leads, ...imported]);
      if (imported[0]) setSelectedId(imported[0].id);
      bumpToast(`Importert ${imported.length} rader.${errors.length ? ` Advarsler: ${errors.length}` : ""}`);
    },
    [leads, persist, bumpToast],
  );

  const emailToday = typeof window !== "undefined" ? countSentToday("email") : 0;
  const liToday = typeof window !== "undefined" ? countSentToday("linkedin") : 0;

  if (!hydrated) {
    return <p className="text-xs text-[rgb(var(--lp-muted))]">Laster utgående…</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3" aria-label="Utgående B2B">
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          Utgående (manuell / CSV)
        </h3>
        <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
          Ingen scraping, ingen auto-LinkedIn. Meldinger må godkjennes. Maks {OUTBOUND_MAX_EMAIL_PER_DAY} e-poster og{" "}
          {OUTBOUND_MAX_LINKEDIN_PER_DAY} LinkedIn-forslag loggført per døgn. Prioritering bruker bl.a. SoMe-branches med
          omsetning. Kantine-innvending: én pivot til catering, deretter ingen lunsj-pitch i nye utkast.
        </p>
        <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
          Innvendinger (analyse): {objectionSnap.pctCanteenOfAnalyses}% kantine-signal av {objectionSnap.analysisRuns}{" "}
          analyser · {objectionSnap.pctCateringOfCanteen}% catering-interesse av kantine-treff (manuelt loggført)
        </p>
      </div>

      {dueFollowUps.length > 0 || pendingFollowUps.length > 0 ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-2 text-[10px] text-[rgb(var(--lp-text))]">
          <div className="font-semibold text-amber-950">Oppfølging (én aktiv per lead, min. 30 døgn)</div>
          {dueFollowUps.length > 0 ? (
            <ul className="mt-1 space-y-2">
              {dueFollowUps.map((f) => (
                <li key={f.leadId} className="rounded border border-amber-100 bg-white/90 p-2">
                  <div className="font-medium">{f.lead?.companyName ?? f.leadId}</div>
                  <p className="mt-1 font-mono text-[9px] text-[rgb(var(--lp-muted))]">{f.message}</p>
                  <button
                    type="button"
                    className="mt-1 min-h-8 rounded border border-[rgb(var(--lp-border))] px-2 text-[10px]"
                    onClick={() => {
                      completeFollowUpForLead(f.leadId);
                      setFollowUpRev((n) => n + 1);
                      bumpToast("Oppfølging markert som håndtert.");
                    }}
                  >
                    Håndtert / loggført
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {pendingFollowUps.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[rgb(var(--lp-muted))]">
              {pendingFollowUps.map((p) => {
                const name = leads.find((l) => l.id === p.leadId)?.companyName ?? p.leadId;
                return (
                  <li key={`${p.leadId}-${p.time}`}>
                    Planlagt {formatDateTimeNO(typeof p.time === "number" ? new Date(p.time).toISOString() : String(p.time))}:{" "}
                    {name} ({p.reason})
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-950" role="status">
          {toast}
        </div>
      ) : null}

      <div className="grid gap-2 text-[11px] text-[rgb(var(--lp-text))]">
        <label className="grid gap-0.5">
          Produkt-/landing-URL (e-post)
          <input
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
            placeholder="https://…"
          />
        </label>
        <p className="text-[10px] text-[rgb(var(--lp-muted))]">
          I dag: {emailToday}/{OUTBOUND_MAX_EMAIL_PER_DAY} e-post · {liToday}/{OUTBOUND_MAX_LINKEDIN_PER_DAY} LinkedIn
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 p-2 text-[11px]">
        <div className="font-semibold">Manuelt lead</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            placeholder="Firmanavn *"
            value={manual.companyName}
            onChange={(e) => setManual((m) => ({ ...m, companyName: e.target.value }))}
            className="h-8 rounded border px-2 text-[11px]"
          />
          <input
            placeholder="Bransje (it, office, …)"
            value={manual.industry}
            onChange={(e) => setManual((m) => ({ ...m, industry: e.target.value }))}
            className="h-8 rounded border px-2 text-[11px]"
          />
          <input
            placeholder="Rolle (hr, manager, …)"
            value={manual.role}
            onChange={(e) => setManual((m) => ({ ...m, role: e.target.value }))}
            className="h-8 rounded border px-2 text-[11px]"
          />
          <input
            placeholder="Kontaktnavn"
            value={manual.contactName}
            onChange={(e) => setManual((m) => ({ ...m, contactName: e.target.value }))}
            className="h-8 rounded border px-2 text-[11px]"
          />
          <input
            placeholder="E-post"
            value={manual.email}
            onChange={(e) => setManual((m) => ({ ...m, email: e.target.value }))}
            className="h-8 rounded border px-2 text-[11px]"
          />
          <input
            placeholder="LinkedIn-URL"
            value={manual.linkedinUrl}
            onChange={(e) => setManual((m) => ({ ...m, linkedinUrl: e.target.value }))}
            className="h-8 rounded border px-2 text-[11px]"
          />
          <input
            placeholder="Antall ansatte (tall)"
            value={manual.companySize}
            onChange={(e) => setManual((m) => ({ ...m, companySize: e.target.value }))}
            className="h-8 rounded border px-2 text-[11px]"
          />
        </div>
        <button
          type="button"
          className="mt-2 min-h-9 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-[11px] font-medium"
          onClick={onAddManual}
        >
          Legg til lead
        </button>
      </div>

      <label className="block text-[11px]">
        <span className="font-semibold">CSV-import</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block w-full text-[10px]"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => onCsv(String(r.result ?? ""));
            r.readAsText(f);
            e.target.value = "";
          }}
        />
      </label>

      <div className="max-h-40 overflow-y-auto rounded border border-slate-200 bg-slate-50/80 p-2 text-[10px]">
        <div className="font-semibold text-[rgb(var(--lp-text))]">Prioritert liste</div>
        <ul className="mt-1 space-y-1">
          {ranked.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className={`w-full rounded px-1 py-0.5 text-left ${l.id === selectedId ? "bg-pink-50 font-medium" : "hover:bg-white"}`}
                onClick={() => {
                  setSelectedId(l.id);
                  setDraft(null);
                  setApprovalStatus("idle");
                  setCrmPreview(null);
                  setReplyPaste("");
                  setObjectionSuggestion(null);
                  setLastDetectedObjection(null);
                }}
              >
                {l.companyName} · {l.industry} · {l.role}
              </button>
            </li>
          ))}
        </ul>
        {ranked.length === 0 ? <p className="text-[rgb(var(--lp-muted))]">Ingen leads — legg til eller importer CSV.</p> : null}
      </div>

      {selected ? (
        <div className="space-y-2 rounded-lg border border-[rgb(var(--lp-border))] bg-slate-50/50 p-2 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <div className="font-semibold">{selected.companyName}</div>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
              Samtale:{" "}
              {conversation?.state === "lunch_pitch"
                ? "lunsj"
                : conversation?.state === "catering_pitch"
                  ? "catering"
                  : "avsluttet"}
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/90 p-2 text-[10px]">
            <div className="font-semibold text-[rgb(var(--lp-text))]">Innvending / svar fra lead</div>
            <textarea
              value={replyPaste}
              onChange={(e) => setReplyPaste(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border px-1 py-1 font-mono text-[10px]"
              placeholder="Lim inn kundens svar (tekst) …"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                type="button"
                className="min-h-9 rounded border border-[rgb(var(--lp-border))] px-2 text-[10px] font-medium"
                onClick={onAnalyzeReply}
              >
                Analyser svar
              </button>
              {objectionSuggestion ? (
                <>
                  <button type="button" className="min-h-9 rounded border px-2 text-[10px]" onClick={onCopyObjectionSuggestion}>
                    Kopier forslag
                  </button>
                  <button
                    type="button"
                    className="min-h-9 rounded border border-pink-500/40 bg-pink-50/80 px-2 text-[10px] font-semibold text-pink-900"
                    onClick={onConfirmPivot}
                  >
                    Bekreft pivot til catering (én gang)
                  </button>
                </>
              ) : null}
            </div>
            {objectionSuggestion ? (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50/80 p-2 text-[10px]">
                {objectionSuggestion}
              </pre>
            ) : null}
            <button
              type="button"
              className="mt-2 min-h-8 text-[10px] underline text-[rgb(var(--lp-muted))]"
              onClick={() => {
                if (!selected) return;
                resetLeadConversation(selected.id);
                setConversationRev((n) => n + 1);
                setObjectionSuggestion(null);
                setLastDetectedObjection(null);
                bumpToast("Samtalestatus nullstilt for dette leadet.");
              }}
            >
              Nullstill samtalestatus
            </button>
          </div>

          <button
            type="button"
            className="min-h-9 rounded-lg border border-pink-500/30 bg-pink-50/80 px-2 text-[11px] font-semibold text-pink-800"
            onClick={onGenerateDrafts}
          >
            {conversation?.state === "catering_pitch"
              ? "Generer catering-utkast (e-post + LinkedIn)"
              : "Generer utkast (e-post + LinkedIn)"}
          </button>

          <div className="rounded-lg border border-slate-200 bg-white/80 p-2 text-[10px]">
            <div className="font-semibold text-[rgb(var(--lp-text))]">Svar (manuelt)</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {conversation?.state === "catering_pitch" ? (
                <button
                  type="button"
                  className="min-h-8 rounded border px-2 text-[10px]"
                  onClick={() => onReply("interested_catering")}
                >
                  Interessert (catering)
                </button>
              ) : conversation?.state !== "closed" ? (
                <button type="button" className="min-h-8 rounded border px-2 text-[10px]" onClick={() => onReply("interested")}>
                  Interessert (lunsj)
                </button>
              ) : null}
              <button
                type="button"
                className="min-h-8 rounded border px-2 text-[10px]"
                onClick={() => onReply("not_interested")}
              >
                Ikke interessert
              </button>
              <button type="button" className="min-h-8 rounded border px-2 text-[10px]" onClick={() => onReply("no_response")}>
                Ingen respons
              </button>
            </div>
          </div>

          {crmPreview ? (
            <pre className="max-h-32 overflow-auto rounded border border-slate-200 bg-white p-2 text-[9px]">
              {JSON.stringify(crmPreview, null, 2)}
            </pre>
          ) : null}

          {draft ? (
            <div className="space-y-2">
              <div>
                <div className="font-medium">E-post</div>
                <label className="mt-1 grid gap-0.5 text-[10px]">
                  Emne
                  <input
                    value={draft.subject}
                    onChange={(e) => setDraft((d) => (d ? { ...d, subject: e.target.value } : d))}
                    className="w-full rounded border px-1 py-1 text-[11px]"
                  />
                </label>
                <label className="mt-1 grid gap-0.5 text-[10px]">
                  Brødtekst
                  <textarea
                    value={draft.body}
                    onChange={(e) => setDraft((d) => (d ? { ...d, body: e.target.value } : d))}
                    rows={8}
                    className="w-full rounded border px-1 py-1 font-mono text-[10px]"
                  />
                </label>
              </div>
              <div>
                <div className="font-medium">LinkedIn (kort, manuelt sendt)</div>
                <textarea
                  value={draft.linkedin}
                  onChange={(e) => setDraft((d) => (d ? { ...d, linkedin: e.target.value } : d))}
                  rows={6}
                  className="mt-1 w-full rounded border px-1 py-1 font-mono text-[10px]"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="min-h-9 rounded-lg bg-[rgb(var(--lp-text))] px-2 text-[11px] font-semibold text-white"
                  onClick={onApprove}
                >
                  Godkjenn
                </button>
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-[11px]"
                  onClick={() => bumpToast("Rediger i feltene over — teksten er ikke låst.")}
                >
                  Rediger
                </button>
                <button type="button" className="min-h-9 px-2 text-[11px] underline" onClick={onReject}>
                  Avvis
                </button>
              </div>

              {approvalStatus === "approved" ? (
                <div className="space-y-2 border-t border-slate-200 pt-2 text-[10px]">
                  <div className="font-semibold">Manuell utsending</div>
                  <div className="flex flex-wrap gap-1">
                    <a
                      href={buildMailtoHref(selected.email, draft.subject, draft.body)}
                      className="inline-flex min-h-9 items-center rounded-lg border border-[rgb(var(--lp-border))] px-2 font-medium"
                      onClick={(e) => {
                        const q = checkOutboundQuota("email");
                        if (q.ok === false) {
                          e.preventDefault();
                          bumpToast(q.reason);
                        }
                      }}
                    >
                      Åpne e-postklient
                    </a>
                    <button type="button" className="min-h-9 rounded border px-2" onClick={onLogEmailSent}>
                      Loggfør e-post sendt
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="min-h-9 rounded border px-2" onClick={onCopyLinkedIn}>
                      Kopier LinkedIn-tekst
                    </button>
                    <button type="button" className="min-h-9 rounded border px-2" onClick={onOpenLinkedIn}>
                      Åpne LinkedIn-profil
                    </button>
                    <button type="button" className="min-h-9 rounded border px-2" onClick={onLogLinkedInSent}>
                      Loggfør LinkedIn sendt
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
