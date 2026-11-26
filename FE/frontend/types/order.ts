import type { PaginationMeta } from "./common";

export type BookingStatus = "CONFIRMED" | "PENDING" | "CANCELLED";
export type MoneyMethod = "CASH" | "BANK_TRANSFER";

export interface OrderItem {
  id: number;
  pnr: string;
  seatNumber: string;
  status: BookingStatus;
  totalPrice: number;
  createdAt: string;
  received: number;
  refunded: number;
  refundDue: number;
  amountDue: number;
  paymentStatus: string;
  transactions: Array<{
    id: number;
    kind: string;
    amount: number;
    method: string;
    reference: string;
    actorName: string;
    createdAt: string;
  }>;
  user: {
    id: number;
    fullName: string;
    phone: string;
    role: string;
  };
  trip: {
    id: number;
    from: string;
    to: string;
    time: string;
    price: number;
    availableSeats: number;
  };
}

export interface OrderQueryParams {
  search?: string;
  status?: string;
  date?: string;
  tripId?: number;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "totalPrice" | "id";
  sortOrder?: "asc" | "desc";
}

export interface OrderListResponse {
  success: boolean;
  data: OrderGroup[];
  pagination: PaginationMeta;
  message?: string;
  stats: OrderStats;
}

export interface OrderDetailResponse {
  success: boolean;
  data?: OrderItem;
  message?: string;
  errors?: unknown[];
}

export interface OrderStats {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  totalRevenue: number;
  orderCount: number;
  transactionCount: number;
  received: number;
  refunded: number;
  refundDue: number;
  amountDue: number;
}

export interface OrderGroup {
  pnr: string;
  createdAt: string;
  totalPrice: number;
  received: number;
  refunded: number;
  refundDue: number;
  amountDue: number;
  tickets: OrderItem[];
}
