import type { PaginationMeta } from "./common";

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: string;
  avatar?: string;
  identityCard?: string;
  address?: string;
  startDate: string;
  createdAt: string;
}

export interface EmployeeQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  department?: string;
  status?: string;
  sortBy?: "name" | "createdAt" | "id";
  sortOrder?: "asc" | "desc";
}

export interface EmployeeListResponse {
  success: boolean;
  data: Employee[];
  pagination: PaginationMeta;
  stats: EmployeeStats;
  message?: string;
}

export interface EmployeeDetailResponse {
  success: boolean;
  data: Employee;
  message?: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  onLeave: number;
  drivers: number;
}
