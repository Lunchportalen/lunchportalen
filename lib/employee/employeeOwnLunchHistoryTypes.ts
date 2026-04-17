/** Delte read-modell-typer for egne ordrehistorikk-rader (operativ `orders`-tabell). */
export type EmployeeOwnLunchHistoryItem = {
  sort_at: string;
  title_nb: string;
  body_nb: string;
  delivery_date_iso: string;
  slot_label_nb: string | null;
  order_id: string;
  status_upper: string;
};

export type EmployeeOwnLunchRecentHistoryPayload = {
  ok: true;
  items: EmployeeOwnLunchHistoryItem[];
  warning_nb: string | null;
};
