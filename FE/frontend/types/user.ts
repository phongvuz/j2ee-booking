import type { PaginationMeta } from "./common";

export interface UserAccount {
  id: number;
  fullName: string;
  phone: string;
  isGuest?: boolean;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    booking: number;
  };
  totalSpent?: number;
}

export interface UserQueryParams {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "fullName" | "id";
  sortOrder?: "asc" | "desc";
}

export interface UserListResponse {
  success: boolean;
  data: UserAccount[];
  pagination: PaginationMeta;
  message?: string;
  stats: UserStats;
}

export interface UserDetailResponse {
  success: boolean;
  data?: UserAccount & {
    bookings?: Array<{
      id: number;
      seatNumber: string;
      status: string;
      totalPrice: number;
      createdAt: string;
      trip: {
        id: number;
        from: string;
        to: string;
        time: string;
      };
    }>;
  };
  message?: string;
  errors?: unknown[];
}

export interface UserStats {
  total: number;
  users: number;
  admins: number;
  newThisMonth: number;
}
