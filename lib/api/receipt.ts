// STATUS: KEEP

// lib/api/receipt.ts
export type OrderReceipt = {
  orderId: string;
  date: string; // YYYY-MM-DD
  status: "ACTIVE" | "CANCELLED";
  updatedAt: string | null;
};

export function receiptPayload(r: OrderReceipt) {
  return {
    receipt: {
      orderId: r.orderId,
      status: r.status,
      date: r.date,
      updatedAt: r.updatedAt,
    },
  };
}
