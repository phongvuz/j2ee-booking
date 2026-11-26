"use client";

import { useCallback, useState } from "react";
import type { TableSortOption, TableSortValue } from "@/types/table-sort";

export function useTableSort<T extends string>(
  initialValue: TableSortValue<T>,
  resetPage: () => void,
  options: TableSortOption<T>[],
) {
  const [sort, setSort] = useState(initialValue);
  const changeSort = useCallback(function changeSort(value: TableSortValue) {
    // Chỉ chấp nhận các cột được cấu hình cho bảng này.
    const option = options.find((item) => item.value === value.sortBy);
    if (option) {
      setSort({
        sortBy: option.value,
        sortOrder: value.sortOrder,
      });
      resetPage();
    }
  }, [resetPage, options]);

  return { sort, setSort: changeSort };
}
