import Link from "next/link";
import { notFound } from "next/navigation";
import { FiCheckCircle } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus, getVietqrPaymentInfo } from "@/services/paymentService";
import { isPaymentDemoEnabled } from "@/lib/vietqr";
import type { VietqrPaymentInfo } from "@/types/payment";
import PaymentPanel from "@/components/payments/PaymentPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thông tin vé và thanh toán | Nhà xe Sài Gòn", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SuccessPage({ searchParams }: {
  searchParams: Promise<{ pnr?: string }>;
}) {
  const params = await searchParams;
  if (typeof params.pnr !== "string" || !params.pnr || params.pnr.length > 191) notFound();
  // Chỉ đọc mã PNR từ URL. Giá, ghế và hành khách phải lấy từ database.
  const bookings = await prisma.booking.findMany({ where: { pnr: params.pnr }, include: { trip: true, user: { select: { fullName: true } } } });
  if (!bookings.length) notFound();
  const first = bookings[0];
  const state = await getPaymentStatus(params.pnr);
  const now = new Date();

  const pendingBookings = bookings.filter((booking) => booking.status === "PENDING");
  const canPay = pendingBookings.length > 0 && pendingBookings.every(
    (booking) =>
      booking.status === "PENDING" &&
      booking.trip.status === "OPEN" &&
      booking.trip.time > now &&
      (
        booking.expiresAt === null ||
        booking.expiresAt > now
      ),
  );
  let paymentInfo: VietqrPaymentInfo | null = null;
  let configurationError = "";
  if (canPay) {
    try { paymentInfo = await getVietqrPaymentInfo(params.pnr); }
    catch { configurationError = "Chưa cấu hình đúng tài khoản nhận chuyển khoản. Vui lòng liên hệ nhà xe."; }
  }
  const total = bookings.reduce((sum, booking) => sum + booking.totalPrice, 0);
  const departure = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(first.trip.time);
  return <div className="min-h-screen bg-gray-100 px-4 py-12">
    <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <FiCheckCircle aria-hidden="true" className="mx-auto mb-4 text-5xl text-green-600" />
      <h1 className="mb-3 text-center text-3xl font-bold text-gray-800">Thông tin đặt vé</h1>
      <p className="mb-6 text-center text-gray-600">Lượt đặt chỗ của bạn đã được lưu vào hệ thống.</p>
      <dl className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm">
        <div><dt className="text-gray-500">Mã đặt chỗ</dt><dd className="break-all font-bold text-blue-700">{params.pnr}</dd></div>
        <div><dt className="text-gray-500">Hành khách</dt><dd className="font-semibold">{first.passengerName ?? first.user.fullName}</dd></div>
        <div><dt className="text-gray-500">Chuyến xe</dt><dd className="font-semibold">#{first.tripId} · {first.trip.from} → {first.trip.to}</dd></div>
        <div><dt className="text-gray-500">Khởi hành</dt><dd className="font-semibold">{departure}</dd></div>
        <div><dt className="text-gray-500">Ghế đã đặt</dt><dd className="font-semibold">{bookings.map((b) => b.seatNumber).join(", ")}</dd></div>
        <div><dt className="text-gray-500">Tổng tiền</dt><dd className="text-lg font-bold text-brand-primary">{total.toLocaleString("vi-VN")} đ</dd></div>
      </dl>
      <PaymentPanel key={`${state.status}:${state.bookingStatus}`} pnr={params.pnr} initial={state} paymentInfo={paymentInfo} canPay={canPay} demoEnabled={isPaymentDemoEnabled()} configurationError={configurationError} />
      <p className="mb-6 text-sm text-gray-500">Vui lòng giữ riêng mã đặt chỗ và xuất trình khi ra bến xe.</p>
      <Link href="/" className="block rounded-md bg-brand-primary px-6 py-3 text-center font-bold text-white hover:bg-brand-dark">Trở về trang chủ</Link>
    </div>
  </div>;
}
