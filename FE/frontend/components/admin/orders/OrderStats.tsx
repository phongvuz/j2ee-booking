"use client";

import type { OrderStats as OrderStatsType } from "@/types";
import { formatPrice } from "@/lib/trip-display";

export function OrderStats({ stats }: { stats: OrderStatsType }) {
  const cards = [
    ["Lượt đặt / Vé", `${stats.orderCount} / ${stats.total}`],
    ["Giao dịch tiền", String(stats.transactionCount)],
    ["Tiền đã thu", formatPrice(stats.received)],
    ["Tiền đã hoàn", formatPrice(stats.refunded)],
    ["Tiền chờ hoàn", formatPrice(stats.refundDue)],
    ["Tiền còn phải thu", formatPrice(stats.amountDue)],
  ];
  return <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>;
}
