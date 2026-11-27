import type { PaginationMeta } from "./common";
import type { BusOption } from "./bus";

export interface TripQueryParams {
  bookable?: boolean;
  search?: string;
  from?: string;
  to?: string;
  date?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "time" | "price" | "availableSeats" | "id";
  sortOrder?: "asc" | "desc";
}

export interface TripAdminItem {
  id: number;
  busId: string;
  bus: BusOption;
  from: string;
  to: string;
  time: string;
  endsAt: string | null;
  status: string;
  driverId: string | null;
  busPlate: string;
  driverName: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  bookedSeatsCount: number;
  occupancyRate: number;
  createdAt: string;
  bookings: Array<{
    id: number;
    seatNumber: string;
    status: string;
    totalPrice: number;
    userName: string;
    userPhone: string;
    paymentStatus: string;
    received: number;
    refunded: number;
  }>;
}

export interface TripStats {
  total: number;
  departingToday: number;
  totalBookings: number;
  avgOccupancy: number;
}

export interface Seat {
  id: string;
  row: string;
  num: number;
  floor: 1 | 2;
  isBooked: boolean;
}

export interface TripSearchParams {
  from?: string | string[];
  to?: string | string[];
  date?: string | string[];
  times?: string | string[];
  vehicles?: string | string[];
  page?: string | string[];
}

export interface TripSearchOption {
  from: string;
  to: string;
  date: string;
}

export interface TripListAdminResponse {
  success: boolean;
  data: TripAdminItem[];
  pagination: PaginationMeta;
  stats: TripStats;
  message?: string;
}
