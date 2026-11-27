export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MutationResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}
