"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage, requestJson } from "@/lib/api-client";
import type { PaymentState, VietqrPaymentInfo } from "@/types/payment";

export default function PaymentPanel({ pnr, initial, paymentInfo, demoEnabled, canPay, configurationError }: {
  pnr: string; initial: PaymentState; paymentInfo: VietqrPaymentInfo | null;
  demoEnabled: boolean; canPay: boolean; configurationError: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);

  async function confirm() {
    setBusy(true); setError("");
    try {
      const result = await requestJson<{ data: PaymentState }>("/api/payments/demo/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pnr }),
      });
      setState(result.data); router.refresh();
    } catch (error) { setError(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  const pending = canPay && state.bookingStatus === "PENDING" && !["SUCCESS", "REVIEW"].includes(state.status);
  return <section className="mb-6 rounded-lg border border-gray-200 p-5" aria-label="Thanh toán VietQR">
    <h2 className="mb-3 text-lg font-bold">Thanh toán chuyển khoản VietQR {demoEnabled && <span className="text-sm text-amber-700">· Demo</span>}</h2>
    {state.refundDue !== undefined && state.refundDue > 0 && <p className="mb-3 text-sm text-amber-800">Vé đã hủy đang chờ hoàn {state.refundDue.toLocaleString("vi-VN")} đ. Liên hệ nhà xe để nhận tiền.</p>}
    {state.refunded !== undefined && state.refunded > 0 && <p className="mb-3 text-sm text-gray-700">Đã ghi nhận hoàn {state.refunded.toLocaleString("vi-VN")} đ.</p>}
    <p role="status" className="mb-4 text-sm text-gray-700">
      {state.status === "REVIEW" ? "Thanh toán cần đối soát. Vui lòng liên hệ nhà xe."
        : state.bookingStatus === "CONFIRMED" ? "Thanh toán đã được xác nhận. Đặt vé hoàn tất."
        : !pending ? "Lượt đặt chỗ đã hết hạn, bị hủy hoặc chuyến đã xuất bến, không thể thanh toán."
        : "Quét mã QR bằng ứng dụng ngân hàng. Số tiền và mã đơn hàng đã được điền sẵn."}
    </p>
    {pending && <>
      {paymentInfo ? <>
        {!imageError && <div className="mb-4 flex justify-center">
          {/* Ảnh động từ API VietQR: dùng img thuần, không cần cấu hình Next Image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={paymentInfo.qrUrl} alt={`Mã VietQR thanh toán đơn ${paymentInfo.order_code}`} width={270} height={320} referrerPolicy="no-referrer" onError={() => setImageError(true)} className="h-auto max-w-full rounded-lg" />
        </div>}
        {imageError && <p role="alert" className="mb-3 text-sm text-amber-800">Không tải được QR. Bạn có thể chuyển khoản thủ công theo thông tin bên dưới hoặc tải lại trang.</p>}
        <dl className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Ngân hàng</dt><dd className="font-semibold">{paymentInfo.bankName}</dd></div>
          <div><dt className="text-gray-500">Số tài khoản</dt><dd className="font-semibold">{paymentInfo.accountNo}</dd></div>
          <div><dt className="text-gray-500">Chủ tài khoản</dt><dd className="font-semibold">{paymentInfo.accountName}</dd></div>
          <div><dt className="text-gray-500">Số tiền</dt><dd className="font-bold text-brand-primary">{paymentInfo.total_amount.toLocaleString("vi-VN")} đ</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Mã đơn hàng / Nội dung chuyển khoản</dt><dd className="font-bold text-blue-700">{paymentInfo.order_code}</dd></div>
        </dl>
        {demoEnabled ? <>
          
          <button type="button" onClick={confirm} disabled={busy} className="w-full rounded-md bg-brand-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang xác nhận…" : "Tôi đã chuyển khoản"}</button>
        </> : <p className="text-sm text-amber-800">Xác nhận demo đang tắt. Vui lòng liên hệ nhà xe để nhân viên đối chiếu chuyển khoản và xác nhận vé.</p>}
      </> : <p role="alert" className="text-sm text-amber-800">{configurationError || "Chưa cấu hình tài khoản nhận tiền."}</p>}
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
