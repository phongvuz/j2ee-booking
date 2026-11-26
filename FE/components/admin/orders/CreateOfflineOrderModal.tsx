"use client";

import { FiX } from "react-icons/fi";
import type { z } from "zod";

import SeatMap from "@/components/trips/SeatMap";
import generateSeats from "@/components/trips/seatUtils";
import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { offlineOrderSchema, OfflineOrderFormValues } from "@/lib/validations/order";
import { formatPrice, formatTripTime } from "@/lib/trip-display";
import { fetchAdminTrips } from "@/services/clientTripService";
import { useRemoteData } from "@/hooks/useRemoteData";
import type { TripAdminItem } from "@/types";

interface CreateOfflineOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OfflineOrderFormValues) => Promise<{ success: boolean; message?: string }>;
}

type OfflineOrderFormInput = z.input<typeof offlineOrderSchema>;

export function CreateOfflineOrderModal(props: CreateOfflineOrderModalProps) {
  if (!props.isOpen) return null;
  return <OfflineOrderForm {...props} />;
}

function OfflineOrderForm({ onClose, onSubmit }: CreateOfflineOrderModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OfflineOrderFormInput, unknown, OfflineOrderFormValues>({
    resolver: zodResolver(offlineOrderSchema),
    defaultValues: {
      tripId: 0,
      seats: [],
      fullName: "",
      phone: "",
      status: "CONFIRMED",
      paymentMethod: "CASH",
    },
  });

  const currentTripId = useWatch({ control, name: "tripId" });
  const seatsWatched = useWatch({ control, name: "seats" });
  const load = useCallback(async function loadBookableTrips(signal: AbortSignal) {
    const response = await fetchAdminTrips({ limit: 100, bookable: true }, signal);
    if (!signal.aborted && response.data.length > 0) {
      setValue("tripId", response.data[0].id);
    }
    return response.data;
  }, [setValue]);
  const { data: trips, loading: loadingTrips, error, refresh } = useRemoteData<TripAdminItem[]>(load, []);
  const selectedTrip = trips.find((trip) => trip.id === currentTripId) ?? null;

  // Chỉ những vé chưa hủy mới chiếm ghế trên sơ đồ.
  const bookedSeatNumbers: string[] = [];
  if (selectedTrip) {
    for (const booking of selectedTrip.bookings) {
      if (booking.status !== "CANCELLED") {
        bookedSeatNumbers.push(booking.seatNumber);
      }
    }
  }

  function resetSelectedSeats() {
    setValue("seats", []);
  }

  function handleToggleSeat(seat: string, booked: boolean) {
    if (booked) {
      return;
    }

    const currentSeats = seatsWatched ?? [];
    let nextSeats: string[];
    if (currentSeats.includes(seat)) {
      nextSeats = currentSeats.filter((value) => value !== seat);
    } else {
      nextSeats = [...currentSeats, seat];
    }

    setValue("seats", nextSeats, { shouldValidate: true });
  }

  async function handleFormSubmit(data: OfflineOrderFormValues) {
    const response = await onSubmit(data);
    if (response.success) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Tạo vé tại quầy (Offline)</h3>
            <p className="text-xs text-gray-500">
              Xuất vé nhanh cho khách hàng mua trực tiếp tại phòng vé
            </p>
          </div>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg p-1 rounded"
          >
            <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 overflow-y-auto space-y-4 flex-1">
          <label className="block text-xs font-semibold">Phương thức thu tiền
            <select {...register("paymentMethod")} className="mt-1 w-full rounded border border-gray-300 p-2"><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select>
          </label>
          {/* Chọn chuyến xe */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Chọn chuyến xe xuất bến <span className="text-rose-500">*</span>
            </label>
            {error ? (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                <p>{error}</p>
                <button type="button" onClick={refresh} className="mt-2 underline">Thử lại</button>
              </div>
            ) : loadingTrips ? (
              <p className="text-xs text-gray-400">Đang tải danh sách chuyến...</p>
            ) : (
              <select
                {...register("tripId", { valueAsNumber: true, onChange: resetSelectedSeats })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              >
                {trips.map((trip) => {
                  const time = formatTripTime(trip.time);
                  return (
                    <option key={trip.id} value={trip.id}>
                      [{trip.id}] {trip.from} &rarr; {trip.to} ({time.departureTime} {time.dateFormatted}) · {trip.bus.plate} · {trip.bus.capacity} chỗ - {formatPrice(trip.price)}
                    </option>
                  );
                })}
              </select>
            )}
            {!loadingTrips && !error && trips.length === 0 && <p className="text-xs text-gray-500">Chưa có chuyến xe để đặt vé.</p>}
            {errors.tripId && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.tripId.message}</p>
            )}
          </div>

          {selectedTrip && <div>
            <SeatMap
              seats={generateSeats(bookedSeatNumbers, selectedTrip.totalSeats)}
              selectedSeats={seatsWatched ?? []}
              isSubmitting={isSubmitting}
              onToggleSeat={handleToggleSeat}
            />
            {errors.seats && <p className="text-xs text-rose-500 mt-1">{errors.seats.message}</p>}
            <p className="text-xs text-gray-500 mt-2">Còn {selectedTrip.availableSeats} ghế trống. Mỗi lượt xuất tối đa 5 vé.</p>
          </div>}

          {/* Họ tên & SĐT khách */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Họ tên hành khách <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn An"
                {...register("fullName")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              {errors.fullName && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Số điện thoại liên hệ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: 0901234567"
                {...register("phone")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              {errors.phone && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.phone.message}</p>
              )}
            </div>
          </div>

          {/* Trạng thái thanh toán */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Hình thức thu tiền
            </label>
            <select
              {...register("status")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            >
              <option value="CONFIRMED">Đã thanh toán (Tiền mặt / Chuyển khoản)</option>
              <option value="PENDING">Giữ chỗ / Chờ thanh toán khi lên xe</option>
            </select>
          </div>

          {/* Tóm tắt tiền */}
          {selectedTrip && (
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-800 font-semibold block">
                  Tổng tiền dự kiến ({seatsWatched?.length ?? 0} ghế):
                </span>
                <span className="text-lg font-black text-emerald-700">
                  {formatPrice((selectedTrip.price || 0) * (seatsWatched?.length ?? 0))}
                </span>
              </div>
              <span className="text-xs text-emerald-700 font-medium">
                Giá gốc: {formatPrice(selectedTrip.price)}/vé
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loadingTrips || Boolean(error) || !selectedTrip}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Đang xuất vé..." : "Xác nhận xuất vé"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
