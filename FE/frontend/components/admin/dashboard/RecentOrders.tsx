import { FiArrowRight } from "react-icons/fi";
import Link from "next/link";
import type { DashboardStats } from "@/types";
import { formatPrice } from "@/lib/trip-display";

export function RecentOrders({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden lg:col-span-2">
      <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-base">Đơn đặt vé gần đây</h3>
          <p className="text-xs text-gray-500">Các giao dịch đặt vé trực tuyến và tại quầy</p>
        </div>
        <Link
          href="/admin/orders"
          className="text-xs font-semibold text-brand-primary hover:underline"
        >
          Xem tất cả <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Mã vé / PNR</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Tuyến & Ghế</th>
              <th className="px-4 py-3">Số tiền</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Đang tải danh sách đơn vé...
                </td>
              </tr>
            ) : !stats?.recentOrders || stats.recentOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Chưa có đơn đặt vé nào trong hệ thống
                </td>
              </tr>
            ) : (
              stats.recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {order.pnr}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{order.user.fullName}</p>
                    <p className="text-[11px] text-gray-400">{order.user.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">
                      {order.trip.from} <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /> {order.trip.to}
                    </p>
                    <p className="text-[11px] text-emerald-600 font-semibold">
                      Ghế: {order.seatNumber}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {formatPrice(order.totalPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === "CONFIRMED"
                          ? "bg-emerald-100 text-emerald-700"
                          : order.status === "PENDING"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {order.status === "CONFIRMED"
                        ? "Đã xác nhận"
                        : order.status === "PENDING"
                        ? "Chờ thanh toán"
                        : "Đã hủy"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
