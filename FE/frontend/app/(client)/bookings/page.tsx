import { FiArrowRight } from "react-icons/fi";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Lịch sử đặt vé | Nhà xe Sài Gòn" };

const statuses: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ thanh toán", className: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Đã xác nhận", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Đã hủy", className: "bg-red-100 text-red-800" },
};
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
});
const moneyFormat = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

export default async function BookingHistoryPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/bookings");

  const bookings = await prisma.booking.findMany({
    where: { userId: customer.userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, pnr: true, seatNumber: true, status: true, totalPrice: true, createdAt: true,
      trip: { select: { id: true, from: true, to: true, time: true } },
    },
  });

  return <div className="mx-auto max-w-4xl px-4 py-10">
    <h1 className="text-3xl font-bold text-gray-900">Lịch sử đặt vé</h1>
    <p className="mt-2 mb-8 text-gray-500">Xem lại các vé đã đặt của bạn, từ mới nhất đến cũ nhất. Thời gian hiển thị theo giờ Việt Nam.</p>
    {bookings.length === 0 ? <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold">Bạn chưa có vé nào</h2>
      <p className="mt-2 text-gray-500">Các vé đã đặt bằng tài khoản này sẽ xuất hiện tại đây.</p>
      <Link href="/trips" className="mt-6 inline-block rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white hover:bg-brand-dark">Tìm chuyến xe</Link>
    </div> : <ul className="space-y-5" aria-label="Danh sách vé đã đặt">
      {bookings.map((booking) => {
        const status = statuses[booking.status] ?? { label: "Chưa xác định", className: "bg-gray-100 text-gray-700" };
        return <li key={booking.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <h2 className="break-all text-lg font-bold text-brand-primary">Mã vé: {booking.pnr ?? `#${booking.id}`}</h2>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.className}`}>{status.label}</span>
          </div>
          <p className="mt-4 text-xl font-bold text-gray-900">{booking.trip.from} <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /> {booking.trip.to}</p>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Mã chuyến xe</dt><dd className="mt-1 font-semibold">{booking.trip.id}</dd></div>
            <div><dt className="text-gray-500">Khởi hành</dt><dd className="mt-1 font-semibold"><time dateTime={booking.trip.time.toISOString()}>{dateFormat.format(booking.trip.time)}</time></dd></div>
            <div><dt className="text-gray-500">Ghế đã đặt</dt><dd className="mt-1 font-semibold">{booking.seatNumber}</dd></div>
            <div><dt className="text-gray-500">Ngày đặt vé</dt><dd className="mt-1 font-semibold"><time dateTime={booking.createdAt.toISOString()}>{dateFormat.format(booking.createdAt)}</time></dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
            <span className="text-sm text-gray-500">Tổng tiền</span>
            <span className="text-xl font-bold text-brand-primary">{moneyFormat.format(booking.totalPrice)}</span>
          </div>
          {booking.pnr && <Link href={`/success?pnr=${encodeURIComponent(booking.pnr)}`} className="mt-4 inline-block text-sm font-semibold text-blue-700 underline">
            {booking.status === "PENDING" ? "Xem vé và thanh toán" : "Xem lượt đặt chỗ"}
          </Link>}
        </li>;
      })}
    </ul>}
  </div>;
}
