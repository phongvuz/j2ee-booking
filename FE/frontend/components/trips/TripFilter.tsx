"use client";

import { FaCircle } from "react-icons/fa";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTripTime, formatPrice } from "@/lib/trip-display";
import { publicTripUrl, tripVehicleLabel, type PublicTripFilters, type TripTimeSlot, type TripVehicleFilter } from "@/lib/public-trip-search";
import type { PaginationMeta } from "@/types/common";
import type { BusOption } from "@/types/bus";

interface TripItem {
  id: number;
  from: string;
  to: string;
  time: Date | string;
  price: number;
  availableSeats: number;
  capacity: number;
  busId: string;
  bus: BusOption;
}

interface TripListWithFilterProps {
  initialTrips: TripItem[];
  filters: PublicTripFilters;
  pagination: PaginationMeta;
}

export default function TripListWithFilter({ initialTrips, filters, pagination }: TripListWithFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectedTimes = filters.times;
  const selectedVehicles = filters.vehicles;

  const updateFilters = (nextFilters: PublicTripFilters) => {
    startTransition(() => router.push(publicTripUrl(nextFilters, 1), { scroll: false }));
  };

  const toggleTimeFilter = (slot: TripTimeSlot) => {
    updateFilters({ ...filters, times: selectedTimes.includes(slot)
      ? selectedTimes.filter((item) => item !== slot) : [...selectedTimes, slot] });
  };

  const toggleVehicleFilter = (type: TripVehicleFilter) => {
    updateFilters({ ...filters, vehicles: selectedVehicles.includes(type)
      ? selectedVehicles.filter((item) => item !== type) : [...selectedVehicles, type] });
  };

  const clearFilters = () => updateFilters({ ...filters, times: [], vehicles: [] });

  const hasActiveFilters = selectedTimes.length > 0 || selectedVehicles.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-8" aria-busy={isPending}>
      <aside className="w-full md:w-1/4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-lg text-gray-800">Bộ lọc tìm kiếm</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                disabled={isPending}
                className="text-xs text-red-500 hover:underline font-medium"
              >
                Xóa lọc
              </button>
            )}
          </div>

          <fieldset className="mb-6" disabled={isPending}>
            <h4 className="font-semibold mb-3 text-sm text-gray-700">Giờ đi</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedTimes.includes("early")}
                  onChange={() => toggleTimeFilter("early")}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Sáng sớm (00:00 - 06:00)
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedTimes.includes("morning")}
                  onChange={() => toggleTimeFilter("morning")}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Sáng (06:00 - 12:00)
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedTimes.includes("afternoon")}
                  onChange={() => toggleTimeFilter("afternoon")}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Chiều (12:00 - 18:00)
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedTimes.includes("night")}
                  onChange={() => toggleTimeFilter("night")}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Tối (18:00 - 24:00)
              </label>
            </div>
          </fieldset>

          <fieldset className="mb-6" disabled={isPending}>
            <h4 className="font-semibold mb-3 text-sm text-gray-700">Loại xe</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedVehicles.includes("sleeper")}
                  onChange={() => toggleVehicleFilter("sleeper")}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Giường nằm
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedVehicles.includes("limousine")}
                  onChange={() => toggleVehicleFilter("limousine")}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Limousine
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedVehicles.includes("other")}
                  onChange={() => toggleVehicleFilter("other")}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Loại xe khác
              </label>
            </div>
          </fieldset>
        </div>
      </aside>

      {/* Danh sách chuyến xe sau khi lọc */}
      <div className="w-full md:w-3/4 flex flex-col space-y-4">
        <p className="text-sm text-gray-600" role="status">
          {isPending ? "Đang tìm chuyến xe…" : `Tìm thấy ${pagination.total} chuyến xe còn đặt được.`}
        </p>
        {initialTrips.length > 0 ? (
          initialTrips.map((trip) => {
            const { departureTime, arrivalTime, dateFormatted } = formatTripTime(trip.time);
            const vehicleType = tripVehicleLabel(trip.bus.capacity, trip.bus.type);

            return (
              <div
                key={trip.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between hover:shadow-md transition-shadow"
              >
                {/* Thông tin chuyến */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-center min-w-[70px]">
                      <p className="text-2xl font-bold text-gray-800">{departureTime}</p>
                      <p className="text-sm text-gray-500">{trip.from}</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center relative px-4">
                      <div className="w-full h-[2px] bg-gray-200 absolute"></div>
                      <span className="bg-white px-2 text-xs text-gray-500 relative z-10 border border-gray-200 rounded-full">
                        {trip.id}
                      </span>
                    </div>
                    <div className="text-center min-w-[70px]">
                      <p className="text-2xl font-bold text-gray-800">{arrivalTime}</p>
                      <p className="text-sm text-gray-500">{trip.to}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded font-medium text-gray-800">
                      {vehicleType}
                    </span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                      Ngày {dateFormatted}
                    </span>
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <FaCircle aria-hidden="true" className="w-2 h-2 shrink-0 text-green-500" />
                      Còn {trip.availableSeats} chỗ trống
                    </span>
                  </div>
                </div>

                {/* Giá và nút chọn */}
                <div className="mt-6 md:mt-0 md:ml-8 flex flex-col items-start md:items-end justify-center md:border-l md:border-gray-100 md:pl-8">
                  <p className="text-2xl font-extrabold text-brand-primary mb-3">
                    {formatPrice(trip.price)}
                  </p>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="bg-brand-primary hover:bg-brand-dark text-white font-bold py-2 px-6 rounded-md transition-colors text-center w-full md:w-auto"
                  >
                    Chọn chuyến
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
            <p className="text-gray-500 text-lg">
              {hasActiveFilters
                ? "Không tìm thấy chuyến xe nào phù hợp với bộ lọc đã chọn."
                : "Không tìm thấy chuyến xe nào phù hợp trong cơ sở dữ liệu."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                disabled={isPending}
                className="mt-3 text-sm text-brand-primary font-semibold hover:underline"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        )}
        {pagination.totalPages > 1 && <nav aria-label="Phân trang chuyến xe" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          {pagination.page > 1 ? <Link href={publicTripUrl(filters, pagination.page - 1)} className="font-semibold text-blue-700 hover:underline">← Trang trước</Link> : <span className="text-gray-400">← Trang trước</span>}
          <span>Trang {pagination.page} / {pagination.totalPages}</span>
          {pagination.page < pagination.totalPages ? <Link href={publicTripUrl(filters, pagination.page + 1)} className="font-semibold text-blue-700 hover:underline">Trang sau →</Link> : <span className="text-gray-400">Trang sau →</span>}
        </nav>}
      </div>
    </div>
  );
}
