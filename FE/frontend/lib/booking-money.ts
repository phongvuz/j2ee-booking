export interface MoneyEntry {
  kind: string;
  amount: number;
  reference: string;
  method: string;
}

export const paymentStatusLabels: Record<string, string> = {
  UNPAID: "Chưa thu tiền",
  PAID: "Đã thu đủ",
  PARTIAL: "Đã thu một phần",
  REFUND_DUE: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
};

export const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  DEMO: "Demo, không phải tiền thật",
  LEGACY: "Dữ liệu cũ, chưa xác minh",
};

export function getBookingMoney(totalPrice: number, status: string, entries: MoneyEntry[]) {
  let received = 0;
  let refunded = 0;
  for (const entry of entries) {
    if (entry.kind === "RECEIPT") received += entry.amount;
    if (entry.kind === "REFUND") refunded += entry.amount;
  }
  const balance = received - refunded;
  const refundDue = status === "CANCELLED" ? balance : 0;
  const amountDue = status === "CANCELLED" ? 0 : Math.max(0, totalPrice - balance);
  let paymentStatus = "UNPAID";
  if (balance >= totalPrice && received > 0) {
    paymentStatus = "PAID";
  } else if (balance > 0) {
    paymentStatus = "PARTIAL";
  } else if (refunded > 0) {
    paymentStatus = "REFUNDED";
  }
  if (refundDue > 0) paymentStatus = "REFUND_DUE";
  return { received, refunded, refundDue, amountDue, paymentStatus };
}

export function getMoneySummary(
  bookings: Array<{ totalPrice: number; status: string; transactions: MoneyEntry[] }>,
  includeDemo = true,
) {
  const summary = { received: 0, refunded: 0, refundDue: 0, amountDue: 0, transactionCount: 0 };
  const references = new Set<string>();
  for (const booking of bookings) {
    const entries = booking.transactions.filter((entry) => includeDemo || entry.method !== "DEMO");
    const money = getBookingMoney(booking.totalPrice, booking.status, entries);
    summary.received += money.received;
    summary.refunded += money.refunded;
    summary.refundDue += money.refundDue;
    const isDemo = booking.transactions.some((entry) => entry.method === "DEMO");
    if (includeDemo || !isDemo) summary.amountDue += money.amountDue;
    for (const entry of entries) references.add(entry.reference);
  }
  summary.transactionCount = references.size;
  return summary;
}
