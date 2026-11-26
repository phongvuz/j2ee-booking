"use client";

import { useRouter } from "next/navigation";
import { TableSort } from "./TableSort";
import type { TableSortOption, TableSortValue } from "@/types/table-sort";

interface TableSortNavigationProps {
  pathname: string;
  query: string;
  value: TableSortValue;
  options: TableSortOption[];
}

export function TableSortNavigation({ pathname, query, value, options }: TableSortNavigationProps) {
  const router = useRouter();

  function changeSort(next: TableSortValue) {
    const params = new URLSearchParams(query);
    params.set("sortBy", next.sortBy);
    params.set("sortOrder", next.sortOrder);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return <TableSort value={value} options={options} onChange={changeSort} />;
}
