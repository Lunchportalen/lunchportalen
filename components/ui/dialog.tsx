"use client";

import * as React from "react";
import {
  getOverlayVariantClass,
  getModalVariantClass,
  type ModalVariant,
} from "@/lib/ui/modalVariants";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type DialogCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DialogContext = React.createContext<DialogCtx | null>(null);

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (v: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  const [internal, setInternal] = React.useState(!!defaultOpen);
  const controlled = typeof open === "boolean";
  const isOpen = controlled ? (open as boolean) : internal;

  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!controlled) setInternal(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange]
  );

  const ctx = React.useMemo(() => ({ open: isOpen, setOpen }), [isOpen, setOpen]);

  return <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>;
}

export function useDialog() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within <Dialog>.");
  return ctx;
}

export type DialogTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const TRIGGER_BASE =
  "lp-motion-btn rounded-xl font-medium outline-none focus-visible:ring-4 focus-visible:ring-[rgba(var(--lp-ring),0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:opacity-70";

export function DialogTrigger({ onClick, className, ...props }: DialogTriggerProps) {
  const { setOpen } = useDialog();
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setOpen(true);
      }}
      className={cn(TRIGGER_BASE, "hover:opacity-90", className)}
      {...props}
    />
  );
}

export type DialogCloseProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function DialogClose({ onClick, className, ...props }: DialogCloseProps) {
  const { setOpen } = useDialog();
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      className={cn(TRIGGER_BASE, "hover:opacity-90", className)}
      {...props}
    />
  );
}

// ✅ IMPORTANT: omit "title" from HTMLAttributes, because HTMLDivElement already has title?: string
export interface DialogContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  showClose?: boolean;
  /** Visual variant for overlay backdrop and modal panel; default "glass" */
  variant?: ModalVariant;
}

export function DialogContent({
  className,
  title,
  description,
  showClose = true,
  variant = "glass",
  children,
  ...props
}: DialogContentProps) {
  const { open, setOpen } = useDialog();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const overlayClass = getOverlayVariantClass(variant);
  const modalClass = getModalVariantClass(variant);

  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);

    // focus
    setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      {/* overlay: shared motion so backdrop and panel use same timing */}
      <div
        className={cn("lp-motion-overlay absolute inset-0", overlayClass)}
        onMouseDown={() => setOpen(false)}
        aria-hidden
      />

      {/* panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "lp-motion-overlay relative w-full max-w-lg text-[color:var(--lp-fg)] outline-none",
          modalClass,
          className
        )}
        {...props}
      >
        {(title || description || showClose) && (
          <div className="flex items-start gap-3 p-6 pb-4">
            <div className="min-w-0">
              {title ? <div className="font-heading text-lg font-semibold">{title}</div> : null}
              {description ? <div className="font-body mt-1 text-sm text-[color:var(--lp-muted)]">{description}</div> : null}
            </div>

            {showClose ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="lp-motion-btn ml-auto rounded-xl p-2 text-[color:var(--lp-muted)] hover:bg-[color:var(--lp-surface-2)] hover:text-[color:var(--lp-fg)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(var(--lp-ring),0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Lukk"
              >
                ✕
              </button>
            ) : null}
          </div>
        )}

        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

/** Modal shell header (use inside DialogContent for custom layout) */
export const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function DialogHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn("lp-modal-header", className)} {...props} />;
});

/** Modal shell body (use inside DialogContent for custom layout) */
export const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function DialogBody({ className, ...props }, ref) {
  return <div ref={ref} className={cn("lp-modal-body", className)} {...props} />;
});

/** Modal shell footer (use inside DialogContent for custom layout) */
export const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function DialogFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn("lp-modal-footer", className)} {...props} />;
});
