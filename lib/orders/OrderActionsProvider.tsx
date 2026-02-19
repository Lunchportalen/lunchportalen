// lib/orders/OrderActionsProvider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useSyncExternalStore } from "react";

/* =========================================================
   A4 — High-traffic global store (NO portal-wide re-render)
========================================================= */

export type OrderActionKind = "PLACE" | "CANCEL" | "UPSERT_NOTE" | "OTHER";

export type OrderReceipt = {
  rid: string;
  ok: true;
  kind: OrderActionKind;
  message?: string;
  timestamp: string; // ISO
  orderId?: string;
  meta?: Record<string, unknown>;
};

export type OrderErr = {
  rid: string;
  ok: false;
  code: string;
  message: string;
  detail?: Record<string, unknown>;
  timestamp: string; // ISO
};

export type OrderPending = {
  rid: string;
  kind: OrderActionKind;
  startedAt: string; // ISO
};

export type Retryable = {
  kind: OrderActionKind;
  run: () => Promise<void>;
  label?: string;
};

export type OrderActionsProviderOptions = {
  maxRetries?: number; // for future backoff logic
  baseDelayMs?: number; // for future backoff logic
};

type State = {
  pending: OrderPending | null;
  receipt: OrderReceipt | null;
  error: OrderErr | null;
  lastRetry: Retryable | null;
};

const initialState: State = {
  pending: null,
  receipt: null,
  error: null,
  lastRetry: null,
};

type Listener = () => void;

type Store = {
  getState: () => State;
  setState: (patch: Partial<State> | ((s: State) => Partial<State>)) => void;
  subscribe: (l: Listener) => () => void;

  // kept stable (ref) — readable by bridges (toast) / future retry policy
  getOptions: () => Required<OrderActionsProviderOptions>;

  actions: {
    clearReceipt: () => void;
    clearError: () => void;
    clearAll: () => void;

    begin: (rid: string, kind: OrderActionKind, retry?: Retryable | null) => void;
    success: (r: Omit<OrderReceipt, "ok"> & { ok?: true }) => void;
    fail: (e: Omit<OrderErr, "ok"> & { ok?: false }) => void;

    retryLast: () => Promise<void>;

    run: <T>(args: {
      rid: string;
      kind: OrderActionKind;
      retry?: Retryable | null;
      exec: () => Promise<T>;
      toReceipt: (
        result: T
      ) => Omit<OrderReceipt, "ok" | "kind" | "rid" | "timestamp"> & { message?: string };
    }) => Promise<T | null>;
  };
};

function nowISO() {
  return new Date().toISOString();
}

function makeStore(options?: OrderActionsProviderOptions): Store {
  const opts: Required<OrderActionsProviderOptions> = {
    maxRetries: typeof options?.maxRetries === "number" ? options.maxRetries : 2,
    baseDelayMs: typeof options?.baseDelayMs === "number" ? options.baseDelayMs : 350,
  };

  let state: State = initialState;
  const listeners = new Set<Listener>();

  const emit = () => {
    listeners.forEach((l) => l());
  };

  const store: Store = {
    getState: () => state,
    getOptions: () => opts,

    setState: (patch) => {
      const nextPatch = typeof patch === "function" ? patch(state) : patch;

      let changed = false;
      const next: State = { ...state };
      (Object.keys(nextPatch) as Array<keyof State>).forEach((k) => {
        const v = nextPatch[k];
        if (typeof v !== "undefined" && next[k] !== v) {
          (next as any)[k] = v;
          changed = true;
        }
      });

      if (!changed) return;
      state = next;
      emit();
    },

    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },

    actions: {
      clearReceipt: () => store.setState({ receipt: null }),
      clearError: () => store.setState({ error: null }),
      clearAll: () => store.setState({ receipt: null, error: null, pending: null }),

      begin: (rid, kind, retry) => {
        store.setState({
          pending: { rid, kind, startedAt: nowISO() },
          error: null,
          lastRetry: retry ?? null,
        });
      },

      success: (r) => {
        store.setState({
          pending: null,
          error: null,
          receipt: {
            ok: true,
            rid: r.rid,
            kind: r.kind,
            message: r.message,
            timestamp: r.timestamp ?? nowISO(),
            orderId: r.orderId,
            meta: r.meta,
          },
        });
      },

      fail: (e) => {
        store.setState({
          pending: null,
          receipt: null,
          error: {
            ok: false,
            rid: e.rid,
            code: e.code,
            message: e.message,
            detail: e.detail,
            timestamp: e.timestamp ?? nowISO(),
          },
        });
      },

      retryLast: async () => {
        const r = store.getState().lastRetry;
        if (!r) return;
        await r.run();
      },

      run: async <T,>(args: {
        rid: string;
        kind: OrderActionKind;
        retry?: Retryable | null;
        exec: () => Promise<T>;
        toReceipt: (
          result: T
        ) => Omit<OrderReceipt, "ok" | "kind" | "rid" | "timestamp"> & { message?: string };
      }) => {
        store.actions.begin(args.rid, args.kind, args.retry ?? null);

        try {
          const result = await args.exec();
          const extra = args.toReceipt(result);

          store.actions.success({
            rid: args.rid,
            kind: args.kind,
            message: extra.message,
            orderId: extra.orderId,
            meta: extra.meta,
            timestamp: nowISO(),
          });

          return result;
        } catch (err: any) {
          store.actions.fail({
            rid: args.rid,
            code: String(err?.code ?? "ORDER_ACTION_FAILED"),
            message: String(err?.message ?? "Uventet feil."),
            detail: { raw: String(err) },
            timestamp: nowISO(),
          });
          return null;
        }
      },
    },
  };

  return store;
}

/* =========================================================
   Selector hook (minimizes renders)
========================================================= */

function shallowEqual(a: any, b: any) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || !a || typeof b !== "object" || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

function useStoreSelector<T>(
  store: Store,
  selector: (s: State) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const last = useRef<T | null>(null);

  const snap = useSyncExternalStore(
    store.subscribe,
    () => store.getState(),
    () => store.getState()
  );

  const selected = selector(snap);

  if (last.current === null) {
    last.current = selected;
    return selected;
  }
  if (isEqual(last.current, selected)) return last.current;
  last.current = selected;
  return selected;
}

/* =========================================================
   Context + Provider
========================================================= */

const Ctx = createContext<Store | null>(null);

export function OrderActionsProvider({
  children,
  options,
}: {
  children: ReactNode;
  options?: OrderActionsProviderOptions;
}) {
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) storeRef.current = makeStore(options);
  return <Ctx.Provider value={storeRef.current}>{children}</Ctx.Provider>;
}

function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("OrderActionsProvider mangler i treet.");
  return s;
}

/* =========================================================
   Public hooks
========================================================= */

export function useOrderActionsGlobal() {
  const store = useStore();
  const actions = store.actions;

  return useMemo(
    () => ({
      clearReceipt: actions.clearReceipt,
      clearError: actions.clearError,
      clearAll: actions.clearAll,
      begin: actions.begin,
      success: actions.success,
      fail: actions.fail,
      retryLast: actions.retryLast,
      run: actions.run,
      // optional: readable by toast bridge / diagnostics
      getOptions: store.getOptions,
    }),
    [actions, store]
  );
}

export function useOrderActionsState() {
  const store = useStore();
  return useStoreSelector(
    store,
    (s) => ({
      pending: s.pending,
      receipt: s.receipt,
      error: s.error,
      hasRetry: Boolean(s.lastRetry),
    }),
    shallowEqual
  );
}

export function useOrderPending() {
  const store = useStore();
  return useStoreSelector(store, (s) => s.pending, Object.is);
}

export function useOrderReceipt() {
  const store = useStore();
  return useStoreSelector(store, (s) => s.receipt, Object.is);
}

export function useOrderError() {
  const store = useStore();
  return useStoreSelector(store, (s) => s.error, Object.is);
}
