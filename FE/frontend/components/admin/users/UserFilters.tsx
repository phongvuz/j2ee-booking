"use client";

import { FiSearch, FiX } from "react-icons/fi";

interface UserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  onReset: () => void;
}

export function UserFilters({
  search,
  onSearchChange,
  role,
  onRoleChange,
  onReset,
}: UserFiltersProps) {
  const hasFilters = Boolean(search || role);

  return (
    <div className="p-4 border-b border-gray-200 bg-gray-50/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 flex-1">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo họ tên, số điện thoại..."
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

        {/* Role filter */}
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        >
          <option value="">Tất cả vai trò</option>
          <option value="CUSTOMER">Khách hàng đã đăng ký</option>
              <option value="USER">Khách hàng (USER)</option>
          <option value="ADMIN">Quản trị viên (ADMIN)</option>
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
