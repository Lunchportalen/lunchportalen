"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableElement,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  headerVariantClasses,
  type HeaderVariant,
} from "@/lib/ui/headerVariants";
import {
  footerVariantClasses,
  type FooterVariant,
} from "@/lib/ui/footerVariants";
import {
  drawerVariantClasses,
  type DrawerVariant,
} from "@/lib/ui/drawerVariants";
import {
  badgeSemanticClasses,
  badgeVariantClasses,
  chipSemanticClasses,
  chipVariantClasses,
  type ChipBadgeSemantic,
  type ChipBadgeVariant,
} from "@/lib/ui/chipBadgeVariants";
import {
  alertSemanticClasses,
  alertVariantClasses,
  toastSemanticClasses,
  toastVariantClasses,
  type FeedbackVariant,
  type FeedbackKind,
} from "@/lib/ui/feedbackVariants";
import type { FormControlVariant } from "@/lib/ui/formControlVariants";
import type { ModalVariant } from "@/lib/ui/modalVariants";
import {
  rowVariantClasses,
  type TableVariant,
} from "@/lib/ui/tableRowVariants";
import {
  stateVariantClasses,
  skeletonVariantClasses,
  emptyVariantClasses,
  errorVariantClasses,
  successVariantClasses,
  pausedVariantClasses,
  type StateSurfaceVariant,
} from "@/lib/ui/stateSurfaceVariants";
import {
  segmentVariantClasses,
  type TabSegmentVariant,
} from "@/lib/ui/tabSegmentVariants";
import { motionClasses } from "@/lib/ui/motionTokens";
import type { CardVariant } from "@/components/ui/card";
import type { ButtonVariant } from "@/components/ui/button";

const VARIANTS: CardVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const MODAL_VARIANTS: ModalVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const DRAWER_VARIANTS: DrawerVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const TAB_VARIANTS: TabSegmentVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const FEEDBACK_VARIANTS: FeedbackVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const FEEDBACK_KINDS: Exclude<FeedbackKind, "default">[] = ["success", "error", "warning", "info"];
const CHIP_BADGE_VARIANTS: ChipBadgeVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const CHIP_BADGE_SEMANTICS: ChipBadgeSemantic[] = ["success", "error", "warning", "info", "neutral"];
const FORM_VARIANTS: FormControlVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const TABLE_ROW_VARIANTS: TableVariant[] = ["glass", "soft", "gradient", "outline", "glow"];
const STATE_SURFACE_VARIANTS: StateSurfaceVariant[] = ["glass", "soft", "gradient", "outline", "glow"];

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function SegmentDemo({ variant }: { variant: TabSegmentVariant }) {
  const [pressed, setPressed] = useState("one");
  const segmentClass = segmentVariantClasses[variant];
  return (
    <div>
      <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
        lp-segment-{variant}
      </p>
      <div className={segmentClass} role="group" aria-label="Filter">
        <button
          type="button"
          aria-pressed={pressed === "one"}
          onClick={() => setPressed("one")}
        >
          One
        </button>
        <button
          type="button"
          aria-pressed={pressed === "two"}
          onClick={() => setPressed("two")}
        >
          Two
        </button>
        <button
          type="button"
          aria-pressed={pressed === "three"}
          onClick={() => setPressed("three")}
        >
          Three
        </button>
      </div>
    </div>
  );
}

export default function DesignShowcasePage() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant | null>(null);

  function triggerSuccess() {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 400);
  }

  const verificationNav = [
    { id: "cards", label: "Cards", states: "Default, hover (lp-motion-card), 5 variants" },
    { id: "buttons", label: "Buttons", states: "Default, hover, focus-visible, active, disabled, 5 variants" },
    { id: "headers", label: "Header shells", states: "5 variants" },
    { id: "footers", label: "Footer shells", states: "5 variants" },
    { id: "modals", label: "Modals", states: "Overlay + panel, 5 variants" },
    { id: "drawers", label: "Drawers", states: "5 variants" },
    { id: "tabs", label: "Tabs / segments", states: "Selected (aria-selected), 5 variants" },
    { id: "feedback", label: "Toasts & alerts", states: "Success, error, warning, info, 5 variants" },
    { id: "chips-badges", label: "Chips & badges", states: "Semantic kinds, 5 variants" },
    { id: "form-controls", label: "Inputs / selects / textareas", states: "Focus-visible, disabled, aria-invalid, 5 variants (Input)" },
    { id: "checkbox-switch", label: "Checkbox & switch", states: "Default, checked, disabled, focus-visible" },
    { id: "tables-rows", label: "Tables & list rows", states: "Row hover, selected, summary, 5 variants" },
    { id: "state-surfaces", label: "Loading / skeleton / empty / error / success", states: "State, skeleton, empty, error, success, paused, 5 variants" },
    { id: "motion", label: "Motion", states: "Hover soft/lift/glow, press, focus, skeleton, success flash" },
  ] as const;

  return (
    <div className="overflow-auto p-6">
      <h1 className="mb-4 font-heading text-2xl font-bold text-[rgb(var(--lp-text))]">
        Design system — verification
      </h1>
      <p className="mb-8 text-sm text-[rgb(var(--lp-muted))]">
        Internal verification instrument. Proves 5-variant support (glass, soft, gradient, outline, glow) and UI states across all key families.
      </p>
      <p className="mb-8 text-xs text-[rgb(var(--lp-muted))]">
        <strong className="text-[rgb(var(--lp-text))]">Showcase coverage:</strong> Cards, buttons, headers, footers, modals, drawers, tabs, segments, toasts, alerts, chips, badges, form controls (input, select, textarea), checkbox, switch, table rows (hover, selected, summary), state surfaces (empty, skeleton, error, success, paused), motion (hover soft/lift/glow, press, focus-visible, skeleton, success flash). Loading and disabled states shown where applicable.
      </p>

      {/* VERIFICATION INDEX */}
      <nav className="mb-12 rounded-card border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-4" aria-label="Verification index">
        <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Families & states verified</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {verificationNav.map(({ id, label, states }) => (
            <li key={id}>
              <a href={`#${id}`} className="font-medium text-[rgb(var(--lp-text))] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))]">
                {label}
              </a>
              <span className="ml-1.5 text-[rgb(var(--lp-muted))]">— {states}</span>
            </li>
          ))}
        </ul>
      </nav>

      {/* CARDS */}
      <section className="mb-12" aria-labelledby="cards-heading" id="cards">
        <h2 id="cards-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Cards
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: default, hover (lp-motion-card), 5 variants.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {VARIANTS.map((v) => (
            <Card key={v} variant={v} className="p-4">
              <div className="text-sm font-medium text-[rgb(var(--lp-text))]">
                {v}
              </div>
              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                lp-card-{v}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* BUTTONS */}
      <section className="mb-12" aria-labelledby="buttons-heading" id="buttons">
        <h2 id="buttons-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Buttons
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: default, hover, focus-visible (tab), active (press), disabled, 5 variants.</p>
        <div className="flex flex-wrap gap-3">
          {(VARIANTS as ButtonVariant[]).map((v) => (
            <Button key={v} variant={v} size="sm">
              {v}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="text-xs text-[rgb(var(--lp-muted))]">Disabled:</span>
          {(VARIANTS as ButtonVariant[]).map((v) => (
            <Button key={`${v}-dis`} variant={v} size="sm" disabled>
              {v}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-xs text-[rgb(var(--lp-muted))]">Loading (disabled + spinner):</span>
          <Button variant="outline" size="sm" disabled>
            <Icon name="loading" size="sm" className="animate-spin shrink-0" />
            Laster…
          </Button>
        </div>
      </section>

      {/* TABS */}
      <section className="mb-12" aria-labelledby="tabs-heading" id="tabs">
        <h2 id="tabs-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Tabs
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: selected (aria-selected), 5 variants.</p>
        <div className="flex flex-wrap gap-8">
          {TAB_VARIANTS.map((v) => (
            <div key={v}>
              <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
                lp-tab-{v}
              </p>
              <Tabs defaultValue="a" variant={v}>
                <TabsList>
                  <TabsTrigger value="a">Tab A</TabsTrigger>
                  <TabsTrigger value="b">Tab B</TabsTrigger>
                  <TabsTrigger value="c">Tab C</TabsTrigger>
                </TabsList>
                <TabsContent value="a">
                  <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Content A</p>
                </TabsContent>
              </Tabs>
            </div>
          ))}
        </div>
      </section>

      {/* SEGMENTED CONTROLS */}
      <section className="mb-12" aria-labelledby="segments-heading">
        <h2 id="segments-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Segmented controls / filter pills
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: pressed (aria-pressed), 5 variants.</p>
        <div className="flex flex-wrap gap-6">
          {TAB_VARIANTS.map((v) => (
            <SegmentDemo key={v} variant={v} />
          ))}
        </div>
      </section>

      {/* HEADER PREVIEWS */}
      <section className="mb-12" aria-labelledby="headers-heading" id="headers">
        <h2 id="headers-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Header previews
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: 5 variants (lp-header-*).</p>
        <div className="space-y-4">
          {(Object.keys(headerVariantClasses) as HeaderVariant[]).map((v) => (
            <div key={v}>
              <p className="mb-1 text-xs text-[rgb(var(--lp-muted))]">
                lp-header-{v}
              </p>
              <div
                className={cn("lp-topbar rounded-t-lg", headerVariantClasses[v])}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-[rgb(var(--lp-text))]">
                    Header strip
                  </span>
                  <span className="text-xs text-[rgb(var(--lp-muted))]">
                    {v}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER PREVIEWS */}
      <section className="mb-12" aria-labelledby="footers-heading">
        <h2 id="footers-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Footer previews
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: 5 variants (lp-footer-*).</p>
        <div className="space-y-4">
          {(Object.keys(footerVariantClasses) as FooterVariant[]).map((v) => (
            <div key={v}>
              <p className="mb-1 text-xs text-[rgb(var(--lp-muted))]">
                lp-footer-{v}
              </p>
              <div
                className={cn(
                  "lp-footer lp-footer--full rounded-b-lg",
                  footerVariantClasses[v]
                )}
              >
                <div className="lp-footer-shell px-4 py-3">
                  <div className="text-sm text-[rgb(var(--lp-muted))]">
                    Footer strip — {v}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODALS */}
      <section className="mb-12" aria-labelledby="modals-heading" id="modals">
        <h2 id="modals-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Modals
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: overlay + panel, 5 variants. Click to open.</p>
        <Dialog open={modalVariant !== null} onOpenChange={(open) => !open && setModalVariant(null)}>
          <div className="flex flex-wrap gap-2">
            {MODAL_VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setModalVariant(v)}
                className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--lp-ring),0.3)]"
              >
                Open {v}
              </button>
            ))}
          </div>
          <DialogContent
            variant={modalVariant ?? "glass"}
            title={modalVariant ? `Modal — ${modalVariant}` : "Modal"}
            description={modalVariant ? `lp-overlay-${modalVariant} + lp-modal-${modalVariant}` : undefined}
          >
            {modalVariant && (
              <p className="text-sm text-[rgb(var(--lp-muted))]">
                Backdrop: lp-overlay-{modalVariant}. Panel: lp-modal-{modalVariant}.
              </p>
            )}
          </DialogContent>
        </Dialog>
      </section>

      {/* DRAWERS / SIDE PANELS */}
      <section className="mb-12" aria-labelledby="drawers-heading" id="drawers">
        <h2 id="drawers-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Drawers / side panels
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: 5 variants (lp-drawer-*).</p>
        <div className="flex flex-wrap gap-4">
          {DRAWER_VARIANTS.map((v) => (
            <div
              key={v}
              className={cn(
                "flex h-48 w-40 flex-col",
                drawerVariantClasses[v],
                "lp-motion-panel"
              )}
            >
              <div className="lp-drawer-header">
                <span className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                  {v}
                </span>
              </div>
              <div className="lp-drawer-body">
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  lp-drawer-{v}
                </p>
              </div>
              <div className="lp-drawer-footer">
                <span className="text-xs text-[rgb(var(--lp-muted))]">
                  Footer
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TOASTS & ALERTS */}
      <section className="mb-12" aria-labelledby="feedback-heading" id="feedback">
        <h2 id="feedback-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Toasts & alerts
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: success, error, warning, info; 5 variants.</p>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Toasts (by variant)</h3>
            <div className="flex flex-wrap gap-3">
              {FEEDBACK_VARIANTS.map((v) => (
                <div
                  key={v}
                  className={cn(
                    motionClasses.toast,
                    "w-56 p-3 text-[color:var(--lp-fg)]",
                    toastVariantClasses[v],
                    toastSemanticClasses.success
                  )}
                >
                  <div className="text-xs font-semibold">Lagret</div>
                  <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">lp-toast-{v} + --success</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Alerts (soft + kind)</h3>
            <div className="flex flex-col gap-2">
              {FEEDBACK_KINDS.map((k) => (
                <div
                  key={k}
                  className={cn(
                    "p-3 text-sm text-[color:var(--lp-fg)]",
                    alertVariantClasses.soft,
                    alertSemanticClasses[k]
                  )}
                  role="alert"
                >
                  <span className="font-medium">{k}</span> — lp-alert-soft + lp-alert--{k}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CHIPS & BADGES */}
      <section className="mb-12" aria-labelledby="chips-badges-heading" id="chips-badges">
        <h2 id="chips-badges-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Chips & badges
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: variant + semantic (success, error, warning, info, neutral); 5 variants.</p>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Chips by variant + semantic</h3>
            <div className="flex flex-wrap gap-2">
              {CHIP_BADGE_VARIANTS.map((v) =>
                CHIP_BADGE_SEMANTICS.slice(0, 3).map((s) => (
                  <span
                    key={`${v}-${s}`}
                    className={cn(
                      "lp-chip inline-flex min-h-[26px] items-center justify-center gap-1 px-2.5 py-1 text-xs font-bold",
                      chipVariantClasses[v],
                      chipSemanticClasses[s]
                    )}
                  >
                    {v} {s}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--lp-text))]">Badges by variant + semantic</h3>
            <div className="flex flex-wrap gap-2">
              {CHIP_BADGE_VARIANTS.map((v) =>
                CHIP_BADGE_SEMANTICS.slice(0, 3).map((s) => (
                  <span
                    key={`${v}-${s}`}
                    className={cn(
                      "lp-badge inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide",
                      badgeVariantClasses[v],
                      badgeSemanticClasses[s]
                    )}
                  >
                    {v} {s}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FORM CONTROLS */}
      <section className="mb-12" aria-labelledby="form-controls-heading" id="form-controls">
        <h2 id="form-controls-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Inputs / selects / textareas
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: default, hover, focus-visible, disabled, aria-invalid. Input: 5 variants.</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FORM_VARIANTS.map((v) => (
            <div key={v}>
              <label className="mb-2 block text-xs font-semibold text-[rgb(var(--lp-muted))]">
                lp-input-{v}
              </label>
              <Input variant={v} placeholder={`Variant: ${v}`} aria-label={`Input ${v}`} />
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold text-[rgb(var(--lp-muted))]">Invalid (aria-invalid)</label>
            <Input variant="soft" placeholder="Feilmelding" aria-invalid={true} aria-label="Input with error" className="max-w-xs" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[rgb(var(--lp-muted))]">Disabled</label>
            <Input variant="soft" placeholder="Deaktivert" disabled aria-label="Input disabled" className="max-w-xs" />
          </div>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold text-[rgb(var(--lp-muted))]">Select (default)</label>
            <Select aria-label="Velg" className="max-w-xs">
              <option value="">Velg…</option>
              <option value="a">A</option>
              <option value="b">B</option>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[rgb(var(--lp-muted))]">Textarea (default)</label>
            <Textarea placeholder="Tekstområde" rows={2} aria-label="Textarea" className="max-w-xs" />
          </div>
        </div>
      </section>

      {/* CHECKBOX & SWITCH */}
      <section className="mb-12" aria-labelledby="checkbox-switch-heading" id="checkbox-switch">
        <h2 id="checkbox-switch-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Checkbox & switch
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: default, checked, disabled, focus-visible.</p>
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Checkbox</span>
            <Checkbox aria-label="Unchecked" />
            <Checkbox defaultChecked aria-label="Checked" />
            <Checkbox disabled aria-label="Disabled" />
            <Checkbox defaultChecked disabled aria-label="Checked disabled" />
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Switch</span>
            <Switch aria-label="Off" />
            <Switch defaultChecked aria-label="On" />
            <Switch disabled aria-label="Disabled" />
            <Switch defaultChecked disabled aria-label="On disabled" />
          </div>
        </div>
      </section>

      {/* TABLES & ROWS */}
      <section className="mb-12" aria-labelledby="tables-rows-heading" id="tables-rows">
        <h2 id="tables-rows-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Tables & rows
        </h2>
        <p className="mb-3 text-sm text-[rgb(var(--lp-muted))]">
          lp-table-* (wrapper) + lp-row-* (tr). Variants: glass, soft, gradient, outline, glow. Summary row: lp-row-summary.
        </p>
        <div className="grid gap-8 sm:grid-cols-1 lg:grid-cols-2">
          {TABLE_ROW_VARIANTS.map((v) => (
            <div key={v}>
              <p className="mb-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                lp-table-{v} + lp-row-{v}
              </p>
              <Table variant={v} className="max-w-md">
                <TableElement>
                  <THead>
                    <tr>
                      <TH>Navn</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <TBody>
                    <TR variant={v}>
                      <TD>Rad 1</TD>
                      <TD>Aktiv</TD>
                    </TR>
                    <TR variant={v} selected>
                      <TD>Rad 2 (valgt)</TD>
                      <TD>Valgt</TD>
                    </TR>
                    <TR variant={v}>
                      <TD>Rad 3</TD>
                      <TD>—</TD>
                    </TR>
                    <tr className={cn(rowVariantClasses[v], "lp-motion-row lp-row-summary last:border-b-0")}>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[rgb(var(--lp-fg))]">Sum</td>
                      <td className="px-5 py-3.5 text-sm text-[rgb(var(--lp-muted))]">3 rader</td>
                    </tr>
                  </TBody>
                </TableElement>
              </Table>
            </div>
          ))}
        </div>
      </section>

      {/* STATE SURFACES */}
      <section className="mb-12" aria-labelledby="state-surfaces-heading" id="state-surfaces">
        <h2 id="state-surfaces-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          State surfaces
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: state, empty, skeleton, error, success, paused; 5 variants.</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STATE_SURFACE_VARIANTS.map((v) => (
            <div key={v}>
              <p className="mb-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">lp-state-{v}</p>
              <div className={cn(stateVariantClasses[v], "p-4 text-sm text-[rgb(var(--lp-fg))]")}>
                Generisk state (loading/empty/paused)
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STATE_SURFACE_VARIANTS.map((v) => (
            <div key={`empty-${v}`}>
              <p className="mb-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">lp-empty-{v}</p>
              <div className={cn(emptyVariantClasses[v], "p-4 text-sm text-[rgb(var(--lp-fg))]")}>
                <p className="font-medium text-[rgb(var(--lp-text))]">Ingen data</p>
                <p className="mt-1 text-[rgb(var(--lp-muted))]">Legg til noe for å se innhold her.</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STATE_SURFACE_VARIANTS.map((v) => (
            <div key={`skeleton-${v}`}>
              <p className="mb-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">lp-skeleton-{v}</p>
              <div className={cn(skeletonVariantClasses[v], "p-4")}>
                <div className={cn(motionClasses.skeleton, "h-4 w-3/4 rounded")} aria-hidden />
                <div className={cn(motionClasses.skeleton, "mt-2 h-4 w-1/2 rounded")} aria-hidden />
                <div className={cn(motionClasses.skeleton, "mt-2 h-8 w-full rounded")} aria-hidden />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">lp-error-outline</p>
            <div className={cn(errorVariantClasses.outline, "p-4 text-sm")}>
              <p className="font-semibold text-[rgb(var(--lp-danger))]">Kunne ikke laste data</p>
              <p className="mt-1 text-[rgb(var(--lp-fg))]">Sjekk tilkobling og prøv igjen.</p>
              <Button variant="outline" size="sm" className="mt-3">Prøv igjen</Button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">lp-success-glow (subtle)</p>
            <div className={cn(successVariantClasses.glow, "p-4 text-sm")}>
              <p className="font-semibold text-[rgb(var(--lp-success))]">Lagret</p>
              <p className="mt-1 text-[rgb(var(--lp-muted))]">Endringene er lagret.</p>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">lp-paused-soft</p>
          <div className={cn(pausedVariantClasses.soft, "max-w-md p-4 text-sm text-[rgb(var(--lp-fg))]")}>
            <p className="font-semibold text-[rgb(var(--lp-text))]">Midlertidig satt på vent</p>
            <p className="mt-1 text-[rgb(var(--lp-muted))]">Handlingen er ikke tilgjengelig akkurat nå.</p>
          </div>
        </div>
      </section>

      {/* MOTION */}
      <section className="mb-8" aria-labelledby="motion-heading" id="motion">
        <h2 id="motion-heading" className="mb-4 font-heading text-lg font-semibold text-[rgb(var(--lp-text))]">
          Motion
        </h2>
        <p className="mb-3 text-xs text-[rgb(var(--lp-muted))]">Verify: hover soft/lift/glow, press, focus-visible, skeleton, success flash.</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
              Hover soft
            </p>
            <div
              className={cn(
                motionClasses.hoverSoft,
                "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] p-4"
              )}
            >
              Hover for slight lift + shadow
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
              Hover lift
            </p>
            <div
              className={cn(
                motionClasses.hoverLift,
                "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] p-4"
              )}
            >
              Hover for elevation + scale
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
              Hover glow
            </p>
            <div
              className={cn(
                motionClasses.hoverGlow,
                "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] p-4"
              )}
            >
              Hover for soft glow
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
              Press
            </p>
            <Button variant="outline" size="sm" className={motionClasses.press}>
              Press me
            </Button>
          </div>
          <div>
            <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
              Focus-visible (tab to focus)
            </p>
            <button
              type="button"
              className={cn(
                motionClasses.focus,
                "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] px-4 py-2 text-sm"
              )}
            >
              Focus me
            </button>
          </div>
          <div>
            <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
              Skeleton
            </p>
            <div
              className={cn(
                motionClasses.skeleton,
                "h-12 rounded-xl bg-[rgb(var(--lp-surface-alt))]"
              )}
              aria-hidden
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-[rgb(var(--lp-muted))]">
              Success flash
            </p>
            <button
              type="button"
              onClick={triggerSuccess}
              className={cn(
                showSuccess && motionClasses.success,
                "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] px-4 py-2 text-sm"
              )}
            >
              Click to trigger
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
