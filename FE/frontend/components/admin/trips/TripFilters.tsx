"use client";

import { FiSearch, FiX } from "react-icons/fi";
import { mergeTripLocations } from "@/lib/trip-locations";

interface TripFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  onReset: () => void;
  locations?: string[];
}

export function TripFilters({
  search,
  onSearchChange,
  from,
  onFromChange,
  to,
  onToChange,
  date,
  onDateChange,
  onReset,
  locations = [],
}: TripFiltersProps) {
  const locationOptions = mergeTripLocations(locations, [from, to]);

  const hasFilters = search !== "" || from !== "" || to !== "" || date !== "";

  function clearSearch() {
    onSearchChange("");
  }

  return (
    <div className="p-4 border-b border-gray-200 bg-gray-50/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">

        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Tìm chuyến xe"
            placeholder="Tìm theo ID chuyến, điểm đi, điểm đến..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs placeholder-gray-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs"><FiSearch aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
          {search && (
            <button
              type="button"
              aria-label="Xóa nội dung tìm kiếm"
              onClick={clearSearch}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
            >
              <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
            </button>
          )}
        </div>

        <select
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          aria-label="Điểm đi"
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        >
          <option value="">Tất cả điểm đi</option>
          {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
        </select>

        <select
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          aria-label="Điểm đến"
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        >
          <option value="">Tất cả điểm đến</option>
          {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
        </select>

        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          aria-label="Ngày khởi hành"
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        />
      </div>

      {hasFilters && (
        <button
          type="button"
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
