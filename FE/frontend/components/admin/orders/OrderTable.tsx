"use client";

import type { OrderGroup, OrderItem, BookingStatus } from "@/types";
import { formatPrice, formatTripTime } from "@/lib/trip-display";
import { paymentStatusLabels } from "@/lib/booking-money";

interface OrderTableProps {
  orders: OrderGroup[];
  loading: boolean;
  busy?: boolean;
  onView: (order: OrderItem) => void;
  onUpdateStatus: (order: OrderItem, status: BookingStatus) => void;
  onCancel: (order: OrderItem) => void;
  onPayment: (order: OrderItem, kind: "RECEIPT" | "REFUND") => void;
}

export function OrderTable({ orders, loading, busy, onView, onUpdateStatus, onCancel, onPayment }: OrderTableProps) {
  if (loading) return <p className="p-8 text-center text-sm text-gray-500">Đang tải lượt đặt...</p>;
  if (!orders.length) return <p className="p-8 text-center text-sm text-gray-500">Không tìm thấy lượt đặt phù hợp.</p>;
  return (
    <div className="divide-y divide-gray-200">
      {orders.map((group) => {
        const first = group.tickets[0];
        if (!first) return null;
        const time = formatTripTime(first.trip.time);
        return (
          <details key={group.pnr} className="group p-4">
            <summary className="cursor-pointer rounded-lg p-2 focus-visible:outline-2 focus-visible:outline-brand-primary">
              <span className="font-bold text-brand-primary">{group.pnr}</span>
              <span className="ml-3 text-sm">{first.user.fullName} · {group.tickets.length} vé</span>
              <span className="mt-2 block text-xs text-gray-600">{first.trip.from} — {first.trip.to} · {time.departureTime}, {time.dateFormatted}</span>
              <span className="mt-2 flex flex-wrap gap-4 text-xs">
                <span>Giá trị vé: {formatPrice(group.totalPrice)}</span>
                <span>Đã thu: {formatPrice(group.received)}</span>
                <span>Đã hoàn: {formatPrice(group.refunded)}</span>
                <span className="text-rose-700">Chờ hoàn: {formatPrice(group.refundDue)}</span>
                <span>Còn phải thu: {formatPrice(group.amountDue)}</span>
              </span>
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {["Vé / Ghế", "Trạng thái vé", "Thanh toán", "Cần thu / hoàn", "Thao tác"].map((label) => (
                      <th key={label} className="p-3">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-t border-gray-100">
                      <td className="p-3">#{ticket.id} · <strong>{ticket.seatNumber}</strong></td>
                      <td className="p-3">{ticket.status === "CANCELLED" ? "Đã hủy" : ticket.status === "CONFIRMED" ? "Đã xác nhận" : "Chờ xác nhận"}</td>
                      <td className="p-3">
                        <strong>{paymentStatusLabels[ticket.paymentStatus]}</strong>
                        <p>Đã thu {formatPrice(ticket.received)}</p>
                        <p>Đã hoàn {formatPrice(ticket.refunded)}</p>
                        {ticket.transactions.some((entry) => entry.method === "DEMO") && (
                          <span className="block text-amber-700">Giao dịch demo</span>
                        )}
                      </td>
                      <td className="p-3">{ticket.refundDue > 0 ? `Chờ hoàn ${formatPrice(ticket.refundDue)}` : ticket.amountDue > 0 ? `Cần thu ${formatPrice(ticket.amountDue)}` : "Đã đối chiếu"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded border px-2 py-1" onClick={() => onView(ticket)}>
                            Chi tiết
                          </button>
                          {ticket.status !== "CANCELLED" && ticket.amountDue > 0 && (
                            <button type="button" disabled={busy} className="rounded bg-emerald-50 px-2 py-1 text-emerald-800 disabled:opacity-50" onClick={() => onPayment(ticket, "RECEIPT")}>
                              Thu tiền
                            </button>
                          )}
                          {ticket.refundDue > 0 && (
                            <button type="button" disabled={busy} className="rounded bg-amber-50 px-2 py-1 text-amber-800 disabled:opacity-50" onClick={() => onPayment(ticket, "REFUND")}>
                              Hoàn tiền
                            </button>
                          )}
                          {ticket.status === "CANCELLED" && new Date(ticket.trip.time) > new Date() && (
                            <button type="button" disabled={busy} className="rounded border px-2 py-1 disabled:opacity-50" onClick={() => onUpdateStatus(ticket, "PENDING")}>
                              Khôi phục
                            </button>
                          )}
                          {ticket.status !== "CANCELLED" && new Date(ticket.trip.time) > new Date() && (
                            <button type="button" disabled={busy} className="rounded bg-rose-50 px-2 py-1 text-rose-800 disabled:opacity-50" onClick={() => onCancel(ticket)}>
                              Hủy vé
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
