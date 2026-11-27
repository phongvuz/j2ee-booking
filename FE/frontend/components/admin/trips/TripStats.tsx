"use client";

import type { TripStats as TripStatsType } from "@/types/trip";

interface TripStatsProps {
  stats: TripStatsType;
}

export function TripStats({ stats }: TripStatsProps) {

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Tổng số chuyến
        </p>
        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        <p className="text-[11px] text-gray-400 mt-1">Các tuyến liên tỉnh</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
          Xuất bến hôm nay
        </p>
        <p className="text-2xl font-bold text-emerald-700">{stats.departingToday}</p>
        <p className="text-[11px] text-emerald-600 mt-1">Lịch trình trong ngày</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
          Vé đã đặt
        </p>
        <p className="text-2xl font-bold text-blue-700">{stats.totalBookings}</p>
        <p className="text-[11px] text-blue-600 mt-1">Ghế có khách</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">
          Tỷ lệ lấp đầy
        </p>
        <p className="text-2xl font-bold text-purple-700">{stats.avgOccupancy}%</p>
        <p className="text-[11px] text-purple-600 mt-1">Hiệu suất vận hành</p>
      </div>
    </div>
  );
}
