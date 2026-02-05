"use client";

import * as React from "react";

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

export function DialogTrigger({ onClick, ...props }: DialogTriggerProps) {
  const { setOpen } = useDialog();
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setOpen(true);
      }}
      {...props}
    />
  );
}

export type DialogCloseProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function DialogClose({ onClick, ...props }: DialogCloseProps) {
  const { setOpen } = useDialog();
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
}

// ✅ IMPORTANT: omit "title" from HTMLAttributes, because HTMLDivElement already has title?: string
export interface DialogContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  showClose?: boolean;
}

export function DialogContent({
  className,
  title,
  description,
  showClose = true,
  children,
  ...props
}: DialogContentProps) {
  const { open, setOpen } = useDialog();
  const panelRef = React.useRef<HTMLDivElement | null>(null);

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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/35" onMouseDown={() => setOpen(false)} />

      {/* panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-lg rounded-3xl",
          "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)]",
          "ring-1 ring-[color:var(--lp-border)]",
          "shadow-[var(--lp-shadow-md)] [box-shadow:var(--lp-shadow-md),var(--lp-shadow-inset)]",
          "outline-none",
          "transition-[transform,opacity] duration-200 [transition-timing-function:var(--lp-ease)]",
          className
        )}
        {...props}
      >
        {(title || description || showClose) && (
          <div className="flex items-start gap-3 p-6 pb-4">
            <div className="min-w-0">
              {title ? <div className="text-lg font-semibold">{title}</div> : null}
              {description ? <div className="mt-1 text-sm text-[color:var(--lp-muted)]">{description}</div> : null}
            </div>

            {showClose ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto rounded-xl p-2 text-[color:var(--lp-muted)] hover:bg-[color:var(--lp-surface-2)] hover:text-[color:var(--lp-fg)]
                           focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--lp-ring)]"
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
