"use client";
import { paymentMethodLabels, paymentStatusLabels } from "@/lib/booking-money";

import { FaBus } from "react-icons/fa";
import { FiArrowRight, FiPrinter, FiX } from "react-icons/fi";
import { OrderItem } from "@/types";
import { formatPrice, formatTripTime } from "@/lib/trip-display";

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderItem | null;
}

export function OrderDetailModal({
  isOpen,
  onClose,
  order,
}: OrderDetailModalProps) {
  if (!isOpen || !order) return null;

  const timeInfo = formatTripTime(order.trip.time);

  let statusClassName = "bg-rose-100 text-rose-800";
  if (order.status === "CONFIRMED") {
    statusClassName = "bg-emerald-100 text-emerald-800";
  } else if (order.status === "PENDING") {
    statusClassName = "bg-amber-100 text-amber-800";
  }
  let statusLabel = "Đã hủy vé";
  if (order.status === "CONFIRMED") {
    statusLabel = "Đã xác nhận & thanh toán";
  } else if (order.status === "PENDING") {
    statusLabel = "Chờ thanh toán";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Ticket Header styled like an e-ticket */}
        <div className="bg-brand-primary text-white p-6 relative">
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded"
          >
            <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl"><FaBus aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-200">
              Vé xe điện tử
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black tracking-tight break-all">{order.pnr}</p>
              <p className="text-xs text-white/80 mt-0.5">
                Chuyến: {order.trip.id} • Ngày đặt: {new Date(order.createdAt).toLocaleDateString("vi-VN")}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-white/80 block">Ghế số</span>
              <span className="text-2xl font-black bg-white/20 px-2.5 py-0.5 rounded-lg inline-block">
                {order.seatNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Ticket Body */}
        <div className="p-6 space-y-4 text-xs max-h-[65vh] overflow-y-auto">
          {/* Status badge */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-gray-500 font-medium">Trạng thái vé:</span>
            <span
              className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${statusClassName}`}
            >
              {statusLabel}
            </span>
          </div>

          {/* Route info */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between text-gray-500 text-[11px]">
              <span>Tuyến đường</span>
              <span>Thời gian khởi hành</span>
            </div>
            <div className="flex items-center justify-between font-bold text-gray-900 text-sm">
              <span>{order.trip.from}</span>
              <span className="text-gray-400 font-normal"><FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
              <span>{order.trip.to}</span>
            </div>
            <div className="text-[11px] text-brand-primary font-semibold pt-1 border-t border-gray-200/60">
              Xuất bến lúc: {timeInfo.departureTime}, Ngày {timeInfo.dateFormatted}
            </div>
          </div>

          {/* Passenger Details */}
          <div className="space-y-2 pb-3 border-b border-gray-100">
            <span className="font-bold text-gray-800 uppercase text-[10px] tracking-wider block">
              Thông tin hành khách
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-400 block text-[11px]">Họ và tên:</span>
                <span className="font-semibold text-gray-900 text-xs">
                  {order.user.fullName}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Số điện thoại:</span>
                <span className="font-semibold text-gray-900 text-xs">
                  {order.user.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Total Price */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3">
            <p className="col-span-2 font-semibold">Thanh toán: {paymentStatusLabels[order.paymentStatus]}</p>
            <p>Đã thu: {formatPrice(order.received)}</p><p>Đã hoàn: {formatPrice(order.refunded)}</p>
            <p>Cần thu: {formatPrice(order.amountDue)}</p><p>Chờ hoàn: {formatPrice(order.refundDue)}</p>
          </div>
          <section aria-label="Lịch sử thu hoàn tiền" className="space-y-2">
            <h3 className="font-bold">Lịch sử thu / hoàn tiền của ghế {order.seatNumber}</h3>
            {order.transactions.length === 0 && <p>Chưa có giao dịch tiền.</p>}
            {order.transactions.map((entry) => <div key={entry.id} className="rounded border border-gray-200 p-3">
              <p className="font-semibold">{entry.kind === "RECEIPT" ? "Thu" : "Hoàn"}: {formatPrice(entry.amount)} · {paymentMethodLabels[entry.method]}</p>
              <p>{entry.actorName} · {new Date(entry.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
              <p className="break-all text-gray-500">Mã giao dịch: {entry.reference}</p>
            </div>)}
          </section>
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-gray-400 block text-[11px]">Tổng cước thanh toán:</span>
              <span className="text-xl font-black text-brand-primary">
                {formatPrice(order.totalPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span><FiPrinter aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>In vé</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-brand-primary hover:bg-brand-dark rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
