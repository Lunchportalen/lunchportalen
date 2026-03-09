export type SupportSnapshot = {
  rid: string;
  pageId?: string | null;
  slug?: string;
  saveStateKey?: string;
  isOnline?: boolean;
  ts?: string;
};

export type StatusLineState = {
  key: string;
  tone: string;
  label: string;
  detail?: string;
  actions: {
    retry?: boolean;
    reload?: boolean;
  };
};

