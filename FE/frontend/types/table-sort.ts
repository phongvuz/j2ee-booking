export type SortOrder = "asc" | "desc";

export interface TableSortValue<T extends string = string> {
  sortBy: T;
  sortOrder: SortOrder;
}

export interface TableSortOption<T extends string = string> {
  value: T;
  label: string;
  ascLabel?: string;
  descLabel?: string;
}
