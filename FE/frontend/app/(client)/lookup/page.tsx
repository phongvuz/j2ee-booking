"use client";

import { FiArrowRight } from "react-icons/fi";
import { useState } from "react";
import { getErrorMessage, requestJson } from "@/lib/api-client";
import Link from "next/link";
import { formatTripTime, formatPrice } from "@/lib/trip-display";

interface BookingResult {
  id: number;
  pnr: string;
  seatNumber: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  trip: {
    id: number;
    from: string;
    to: string;
    time: string;
    price: number;
  };
  user: {
    fullName: string;
    phone: string;
  };
}

export default function Lookup() {
  const [pnr, setPnr] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<BookingResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const reference = pnr.trim();
    const passengerPhone = phone.trim();
    if (!reference || !passengerPhone || isLoading) return;

    try {
      setIsLoading(true);
      setSearched(true);
      setError("");
      setResults(null);
      const params = new URLSearchParams({ pnr: reference, phone: passengerPhone });
      const response = await requestJson<{ success: boolean; data: BookingResult[] }>(`/api/bookings?${params}`);
      if (!Array.isArray(response.data)) throw new Error("Dữ liệu tra cứu không hợp lệ.");
      setResults(response.data);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">TRA CỨU THÔNG TIN VÉ</h2>
        <p className="text-gray-500">
          Nhập mã đặt chỗ (PNR) và số điện thoại hành khách để tra cứu vé.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div>
            <label htmlFor="lookup-pnr" className="mb-1 block text-sm font-semibold text-gray-700">Mã đặt chỗ (PNR)</label>
            <input
              id="lookup-pnr"
              name="pnr"
              type="text"
              required
              maxLength={191}
              autoComplete="off"
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder="NHAXE-..."
              className="w-full border border-gray-300 rounded-xl p-3.5 focus:outline-none focus:border-brand-primary text-gray-700 bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="lookup-phone" className="mb-1 block text-sm font-semibold text-gray-700">Số điện thoại hành khách</label>
            <input
              id="lookup-phone"
              name="phone"
              type="tel"
              required
              maxLength={12}
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Số điện thoại đã dùng khi đặt vé"
              className="w-full border border-gray-300 rounded-xl p-3.5 focus:outline-none focus:border-brand-primary text-gray-700 bg-gray-50"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !pnr.trim() || !phone.trim()}
            className={`font-bold px-8 py-3.5 rounded-xl transition shadow-sm ${
              isLoading || !pnr.trim() || !phone.trim()
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-brand-primary hover:bg-orange-600 text-white cursor-pointer"
            }`}
          >
            {isLoading ? "Đang tra cứu..." : "Tra cứu"}
          </button>
        </form>
      </div>

      {error && <div role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
        <p>{error}</p><button type="button" onClick={() => handleSearch()} className="mt-2 underline">Thử lại</button>
      </div>}
      {searched && !isLoading && !error && (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 text-lg">
            Kết quả tra cứu ({results ? results.length : 0} vé tìm thấy):
          </h3>

          {results && results.length > 0 ? (
            results.map((booking) => {
              const { departureTime, dateFormatted } = formatTripTime(
                booking.trip?.time || ""
              );
              const pnrCode = booking.pnr;

              return (
                <div
                  key={booking.id}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-orange-300 transition-colors"
                >
                  <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <span className="font-bold text-brand-primary text-lg">
                      Mã PNR: {pnrCode}
                    </span>
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        booking.status === "CONFIRMED"
                          ? "bg-green-100 text-green-700"
                          : booking.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {booking.status === "CONFIRMED"
                        ? "Đã xác nhận"
                        : booking.status === "PENDING"
                        ? "Chờ xác nhận"
                        : "Đã hủy"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Họ tên khách hàng</p>
                      <p className="font-bold text-gray-800 text-base">
                        {booking.user?.fullName || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Số điện thoại</p>
                      <p className="font-bold text-gray-800 text-base">
                        {booking.user?.phone || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Tuyến xe</p>
                      <p className="font-bold text-blue-600 text-base">
                        {booking.trip
                          ? <>{booking.trip.from} <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /> {booking.trip.to}</>
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Ghế đã đặt</p>
                      <p className="font-extrabold text-brand-primary text-base">
                        {booking.seatNumber}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm gap-2">
                    <span className="text-gray-500">
                      Khởi hành: <strong className="text-gray-800">{departureTime}</strong> ({dateFormatted}) | Mã chuyến: <strong className="text-gray-800">{booking.trip?.id}</strong>
                    </span>
                    <span className="text-xl font-bold text-brand-primary">
                      {formatPrice(booking.totalPrice)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
              <p className="text-gray-500">
                Không tìm thấy vé khớp với mã đặt chỗ và số điện thoại đã nhập. Vui lòng kiểm tra lại cả hai thông tin.
              </p>
              <Link
                href="/trips"
                className="inline-block mt-4 text-brand-primary font-semibold hover:underline"
              >
                Đặt vé chuyến mới ngay <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
