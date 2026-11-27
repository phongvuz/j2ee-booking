"use client";

import React from "react";

interface BookingFormProps {
  tripId: number;
  selectedSeats: string[];
  pricePerSeat: number;
  totalPrice: number;
  passengerName: string;
  passengerPhone: string;
  isSubmitting: boolean;
  errorMessage: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function BookingForm({
  tripId,
  selectedSeats,
  pricePerSeat,
  totalPrice,
  passengerName,
  passengerPhone,
  isSubmitting,
  errorMessage,
  onNameChange,
  onPhoneChange,
  onSubmit,
}: BookingFormProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-24">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
        Thông tin đặt vé
      </h3>

      <div className="mb-6">
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-600">Chuyến xe:</span>
          <span className="font-bold text-gray-800">{tripId}</span>
        </div>
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-600">Ghế đã chọn:</span>
          <span className="font-bold text-brand-primary">
            {selectedSeats.length > 0 ? selectedSeats.join(", ") : "Chưa chọn"}
          </span>
        </div>
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-600">Giá mỗi vé:</span>
          <span className="font-semibold text-gray-700">
            {pricePerSeat.toLocaleString("vi-VN")} đ
          </span>
        </div>
        <div className="flex justify-between mt-4 pt-4 border-t border-gray-100">
          <span className="text-gray-800 font-bold text-lg">Tổng tiền:</span>
          <span className="font-extrabold text-2xl text-brand-primary">
            {totalPrice.toLocaleString("vi-VN")} đ
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {errorMessage}
        </div>
      )}

      {/* Form nhập thông tin hành khách */}
      <form onSubmit={onSubmit}>
        <h4 className="font-bold text-gray-800 mb-3 text-sm">
          Thông tin hành khách
        </h4>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Họ và tên *
            </label>
            <input
              type="text"
              required
              value={passengerName}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-brand-primary"
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Số điện thoại *
            </label>
            <input
              type="tel"
              required
              value={passengerPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-brand-primary"
              placeholder="Ví dụ: 0901234567"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={selectedSeats.length === 0 || isSubmitting}
          className={`w-full font-bold py-3 px-4 rounded-md transition-colors ${
            selectedSeats.length > 0 && !isSubmitting
              ? "bg-brand-primary hover:bg-brand-dark text-white cursor-pointer"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? "Đang xử lý đặt vé..." : "Xác nhận đặt vé"}
        </button>
      </form>
    </div>
  );
}
