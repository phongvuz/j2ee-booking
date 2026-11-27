"use client";

import { FiAlertTriangle } from "react-icons/fi";
import React from "react";
import { UserAccount } from "@/types";

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  onConfirmDelete: (id: number) => Promise<{ success: boolean; message?: string }>;
}

export function DeleteUserModal({
  isOpen,
  onClose,
  user,
  onConfirmDelete,
}: DeleteUserModalProps) {
  const [loading, setLoading] = React.useState(false);

  if (!isOpen || !user) return null;
  const userId = user.id;

  async function handleDelete() {
    setLoading(true);
    const response = await onConfirmDelete(userId);
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
          Xác nhận xóa người dùng
        </h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Bạn có chắc chắn muốn xóa tài khoản của{" "}
          <strong className="text-gray-900">{user.fullName}</strong> ({user.phone}) khỏi hệ thống? Chỉ xóa được tài khoản chưa có lịch sử vé. Với tài khoản đã có vé, hãy khóa đăng nhập tại màn hình chỉnh sửa.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleDelete}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Đang xóa..." : "Xác nhận xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}
