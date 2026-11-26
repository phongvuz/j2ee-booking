"use client";

import { FiSearch, FiX } from "react-icons/fi";

interface BusFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function BusFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  onReset,
}: BusFiltersProps) {
  const hasFilters = Boolean(search || type || status);

  return (
    <div className="p-4 border-b border-gray-200 bg-gray-50/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 flex-1">
        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm biển số, tài xế, hãng xe..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs placeholder-gray-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs"><FiSearch aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
          {search && (
            <button
              aria-label="Đóng"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
            >
              <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        >
          <option value="">Tất cả loại xe</option>
          <option value="Limousine 22 phòng">Limousine 22 phòng</option>
          <option value="Giường nằm 34 chỗ">Giường nằm 34 chỗ</option>
          <option value="Ghế ngồi 28 chỗ">Ghế ngồi 28 chỗ</option>
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Đang hoạt động">Đang hoạt động</option>
          <option value="Bảo dưỡng">Bảo dưỡng</option>
          <option value="Ngừng hoạt động">Ngừng hoạt động</option>
        </select>
      </div>

      {hasFilters && (
        <button
          onClick={onReset}
          className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors self-end md:self-auto flex items-center gap-1 cursor-pointer"
        >
          <span><FiX aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
          <span>Xóa bộ lọc</span>
        </button>
      )}
    </div>
  );
}
