import type { BusQueryParams, EmployeeQueryParams, OrderQueryParams, TripQueryParams, UserQueryParams } from "@/types";
import type { TableSortOption } from "@/types/table-sort";

const createdAtOption = { value: "createdAt", label: "Ngày tạo", ascLabel: "Cũ nhất trước", descLabel: "Mới nhất trước" } as const;

export const tripSortOptions = [
  createdAtOption,
  { value: "time", label: "Thời gian xuất bến", ascLabel: "Sớm nhất trước", descLabel: "Muộn nhất trước" },
  { value: "price", label: "Giá vé" },
  { value: "availableSeats", label: "Số ghế trống" },
  { value: "id", label: "Mã chuyến" },
] satisfies TableSortOption<NonNullable<TripQueryParams["sortBy"]>>[];

export const busSortOptions = [
  createdAtOption,
  { value: "plate", label: "Biển số", ascLabel: "A → Z", descLabel: "Z → A" },
  { value: "capacity", label: "Số chỗ" },
  { value: "id", label: "Mã xe" },
] satisfies TableSortOption<NonNullable<BusQueryParams["sortBy"]>>[];

export const employeeSortOptions = [
  createdAtOption,
  { value: "name", label: "Họ tên", ascLabel: "A → Z", descLabel: "Z → A" },
  { value: "id", label: "Mã nhân viên" },
] satisfies TableSortOption<NonNullable<EmployeeQueryParams["sortBy"]>>[];

export const orderSortOptions = [
  createdAtOption,
  { value: "totalPrice", label: "Tổng tiền" },
  { value: "id", label: "Mã vé" },
] satisfies TableSortOption<NonNullable<OrderQueryParams["sortBy"]>>[];

export const userSortOptions = [
  createdAtOption,
  { value: "fullName", label: "Họ tên", ascLabel: "A → Z", descLabel: "Z → A" },
  { value: "id", label: "Mã người dùng" },
] satisfies TableSortOption<NonNullable<UserQueryParams["sortBy"]>>[];

export type PaymentSortBy = "createdAt" | "amount" | "pnr" | "id";

export const paymentSortOptions = [
  createdAtOption,
  { value: "amount", label: "Số tiền" },
  { value: "pnr", label: "Mã đặt chỗ" },
  { value: "id", label: "Mã giao dịch" },
] satisfies TableSortOption<PaymentSortBy>[];
