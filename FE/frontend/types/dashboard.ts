import { OrderItem } from "./order";

export interface DashboardStats {
  received: number;
  refunded: number;
  refundDue: number;
  amountDue: number;
  revenueThisMonth: number;
  revenueToday: number;
  revenueGrowthPercent: number;
  ticketsSoldToday: number;
  ticketsGrowthPercent: number;
  totalBuses: number;
  activeBuses: number;
  totalEmployees: number;
  activeEmployees: number;
  totalTrips: number;
  totalUsers: number;
  recentOrders: OrderItem[];
  systemAlerts: SystemAlert[];
}

export interface SystemAlert {
  id: string;
  type: "warning" | "success" | "info" | "danger";
  title: string;
  message: string;
  time: string;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardStats;
  message?: string;
}
