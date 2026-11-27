"use client";

import { FiAlertTriangle } from "react-icons/fi";
import React from "react";
import { OrderItem } from "@/types";

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderItem | null;
  onConfirmCancel: (id: number) => Promise<{ success: boolean; message?: string }>;
}

export function CancelOrderModal({
  isOpen,
  onClose,
  order,
  onConfirmCancel,
}: CancelOrderModalProps) {
  const [loading, setLoading] = React.useState(false);

  if (!isOpen || !order) return null;
  const orderId = order.id;

  async function handleCancel() {
    setLoading(true);
    const response = await onConfirmCancel(orderId);
    setLoading(false);
    if (response.success) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl mx-auto mb-4 font-bold">
          <FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">
          Xác nhận hủy vé xe
        </h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Bạn có chắc chắn muốn hủy đơn vé <strong className="text-gray-900">{order.pnr}</strong> (Ghế {order.seatNumber} của khách {order.user.fullName})?
          <br />
          <span className="text-emerald-600 font-semibold block mt-1">
            Ghế này sẽ tự động được hoàn trả vào số ghế trống của chuyến xe.
          </span>
          {order.received > order.refunded && <span className="block mt-2">Khoản đã thu được giữ nguyên trong sổ tiền. Sau khi hủy vé, dùng nút “Hoàn tiền” để ghi nhận khoản đã thực trả cho khách.</span>}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleCancel}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Đang hủy..." : "Xác nhận hủy vé"}
          </button>
        </div>
      </div>
    </div>
  );
}
