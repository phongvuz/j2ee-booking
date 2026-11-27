"use client";

import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import type { ChangeEvent } from "react";
import type { TableSortOption, TableSortValue } from "@/types/table-sort";

interface TableSortProps {
  value: TableSortValue;
  options: TableSortOption[];
  onChange: (value: TableSortValue) => void;
}

export function TableSort({ value, options, onChange }: TableSortProps) {

  const selectedOption = options.find((option) => option.value === value.sortBy);
  let ascLabel = "Tăng dần";
  let descLabel = "Giảm dần";

  if (selectedOption) {
    if (selectedOption.ascLabel) {
      ascLabel = selectedOption.ascLabel;
    }
    if (selectedOption.descLabel) {
      descLabel = selectedOption.descLabel;
    }
  }

  function handleSortByChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange({
      sortBy: event.target.value,
      sortOrder: value.sortOrder,
    });
  }

  function handleSortOrderChange(event: ChangeEvent<HTMLSelectElement>) {
    const sortOrder = event.target.value;

    if (sortOrder === "asc" || sortOrder === "desc") {
      onChange({
        sortBy: value.sortBy,
        sortOrder: sortOrder,
      });
    }
  }

  const selectClassName = "min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer";

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-b border-gray-200 bg-gray-50/60 px-4 py-3">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
        <span>Sắp xếp theo</span>
        <select
          aria-label="Sắp xếp theo"
          value={value.sortBy}
          onChange={handleSortByChange}
          className={selectClassName}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
        {value.sortOrder === "asc" ? <FiArrowUp aria-hidden="true" /> : <FiArrowDown aria-hidden="true" />}
        <span className="sr-only">Thứ tự sắp xếp</span>
        <select
          aria-label="Thứ tự sắp xếp"
          value={value.sortOrder}
          onChange={handleSortOrderChange}
          className={selectClassName}
        >
          <option value="asc">{ascLabel}</option>
          <option value="desc">{descLabel}</option>
        </select>
      </label>
    </div>
  );
}
