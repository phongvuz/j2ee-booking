import type { PaginationMeta } from "./common";

export interface Bus {
  id: string;
  plate: string;
  type: string;
  capacity: number;
  status: string;
  brand?: string;
  year?: number;
  driverName?: string;
  driverPhone?: string;
  lastMaintenance?: string;
  notes?: string;
  createdAt: string;
}

export interface BusQueryParams {
  search?: string;
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: "plate" | "capacity" | "createdAt" | "id";
  sortOrder?: "asc" | "desc";
}

export interface BusListResponse {
  success: boolean;
  data: Bus[];
  pagination: PaginationMeta;
  stats: BusStats;
  message?: string;
}

export interface BusDetailResponse {
  success: boolean;
  data?: Bus;
  message?: string;
  errors?: unknown[];
}

export interface BusStats {
  total: number;
  active: number;
  maintenance: number;
  inactive: number;
}

export type BusOption = Pick<Bus, "id" | "plate" | "type" | "capacity" | "status">;
