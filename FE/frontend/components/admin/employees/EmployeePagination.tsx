"use client";

import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { PaginationMeta } from "@/types";

interface EmployeePaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function EmployeePagination({
  pagination,
  onPageChange,
  onLimitChange,
}: EmployeePaginationProps) {
  const { page, limit, total, totalPages } = pagination;

  let start = 0;
  if (total !== 0) {
    start = (page - 1) * limit + 1;
  }
  const end = Math.min(page * limit, total);

  // Generate page numbers to show
  function getPageNumbers() {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        pages.push(pageNumber);
      }
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
      }
    }
    return pages;
  }

  return (
    <div className="p-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
      {/* Total records and page size selector */}
      <div className="flex items-center gap-3">
        <span>
          Hiển thị <span className="font-semibold text-gray-900">{start}</span> -{" "}
          <span className="font-semibold text-gray-900">{end}</span> trên{" "}
          <span className="font-semibold text-gray-900">{total}</span> nhân viên
        </span>

        <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200">
          <span className="text-xs text-gray-500">Mỗi trang:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:border-brand-primary cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={12}>12</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Trang trước"
        >
          <FiArrowLeft aria-hidden="true" className="inline-block shrink-0 align-middle" /> Trước
        </button>

        {getPageNumbers().map((p, idx) =>
          typeof p === "number" ? (
            <button
              key={idx}
              type="button"
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded text-xs font-semibold transition-colors cursor-pointer ${p === page
                ? "bg-brand-primary text-white shadow-sm"
                : "border border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="px-1 text-xs text-gray-400">
              ...
            </span>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Trang tiếp"
        >
          Sau <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" />
        </button>
      </div>
    </div>
  );
}
