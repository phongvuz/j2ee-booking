"use client";

import { FaRoad } from "react-icons/fa";
import { FiArrowRight, FiX } from "react-icons/fi";
import type { TripAdminItem } from "@/types/trip";
import { formatPrice, formatTripTime } from "@/lib/trip-display";
import { tripStatusLabels } from "@/lib/trip-status";
import { paymentStatusLabels } from "@/lib/booking-money";

interface TripDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripAdminItem | null;
  onEdit: (trip: TripAdminItem) => void;
}

export function TripDetailModal({
  isOpen,
  onClose,
  trip,
  onEdit,
}: TripDetailModalProps) {
  if (!isOpen || !trip) return null;

  const timeInfo = formatTripTime(trip.time);

  const activeBookings = trip.bookings.filter((booking) => booking.status !== "CANCELLED");

  function handleEdit() {
    if (!trip) return;
    onClose();
    onEdit(trip);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        <div className="p-6 bg-slate-900 text-white relative">
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded"
          >
            <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-primary text-white flex items-center justify-center text-2xl font-bold shadow-sm">
              <FaRoad aria-hidden="true" className="inline-block shrink-0 align-middle" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded">
                Mã: {trip.id}
              </span>
              <h2 className="text-lg font-extrabold tracking-tight mt-1">
                {trip.from} <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /> {trip.to}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Xuất bến: {timeInfo.departureTime}, Ngày {timeInfo.dateFormatted}
              </p>
            </div>
          </div>
        </div>

   
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          <div className="rounded-xl border border-gray-200 p-3.5">
            <span className="text-[11px] text-gray-500">Xe phục vụ</span>
            <p className="mt-1 font-bold text-gray-900">{trip.bus.plate} · {trip.bus.type}</p>
            <p className="mt-1 text-gray-500">Sức chứa: {trip.bus.capacity} chỗ · {trip.bus.status}</p>
          </div>
    
          <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center">
            <div>
              <span className="text-[11px] text-gray-500 block">Giá vé</span>
              <span className="font-extrabold text-sm text-brand-primary">
                {formatPrice(trip.price)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block">Ghế trống</span>
              <span className="font-extrabold text-sm text-gray-900">
                {trip.availableSeats} / {trip.totalSeats}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block">Lấp đầy</span>
              <span className="font-extrabold text-sm text-purple-700">
                {trip.occupancyRate}%
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-600">{tripStatusLabels[trip.status]} · Xe {trip.busPlate || "chưa phân công"} · Tài xế {trip.driverName || "chưa phân công"}</p>
          {trip.endsAt && <p className="text-xs text-gray-600">Kết thúc dự kiến: {new Date(trip.endsAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                Danh sách hành khách đã đặt chỗ ({activeBookings.length} vé)
              </span>
            </div>

            {activeBookings.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                Chưa có khách đặt vé cho chuyến xe này
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {activeBookings.map((booking) => (
                  <div key={booking.id} className="p-3 flex items-center justify-between bg-white hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs">
                        {booking.seatNumber}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{booking.userName}</p>
                        <p className="text-[11px] text-gray-400">{booking.userPhone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900 text-xs block">
                        {formatPrice(booking.totalPrice)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          booking.status === "CONFIRMED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {paymentStatusLabels[booking.paymentStatus]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Chỉnh sửa chuyến xe
          </button>
        </div>
      </div>
    </div>
  );
}
