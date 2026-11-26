"use client";

import { FiAlertTriangle, FiInfo } from "react-icons/fi";
import { useState } from "react";
import { Employee } from "@/types";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onConfirmDelete: (id: string) => Promise<{ success: boolean; message?: string }>;
  onConfirmDeactivate: (id: string) => Promise<{ success: boolean; message?: string }>;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  employee,
  onConfirmDelete,
  onConfirmDeactivate,
}: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  if (!isOpen || !employee) return null;
  const employeeId = employee.id;

  async function handleDelete() {
    setIsDeleting(true);
    const response = await onConfirmDelete(employeeId);
    setIsDeleting(false);
    if (response.success) {
      onClose();
    }
  }

  async function handleDeactivate() {
    setIsDeactivating(true);
    const response = await onConfirmDeactivate(employeeId);
    setIsDeactivating(false);
    if (response.success) {
      onClose();
    }
  }

  const isBusy = isDeleting || isDeactivating;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 text-center">
          {/* Warning Icon */}
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            <FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Xác nhận thao tác với nhân viên
          </h3>

          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            Bạn đang thao tác với nhân sự{" "}
            <span className="font-bold text-gray-900">{employee.name}</span> (Mã:{" "}
            <span className="font-semibold text-brand-primary">{employee.id}</span>).
            <br />
            Bạn có thể chuyển trạng thái sang <span className="font-semibold text-amber-700">&quot;Đã nghỉ việc&quot;</span> hoặc{" "}
            <span className="font-semibold text-rose-700">xóa vĩnh viễn</span> khỏi hệ thống.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 mb-6">
            <FiInfo aria-hidden="true" className="inline-block shrink-0 align-middle" /> <strong>Khuyên dùng:</strong> Chọn <em>&quot;Chuyển Đã nghỉ việc&quot;</em> để bảo toàn lịch sử dữ liệu chuyến xe và phân công đã thực hiện trong quá khứ.
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isDeactivating ? (
                <span>Đang xử lý...</span>
              ) : (
                <span>Vô hiệu hóa (Đổi sang Đã nghỉ việc)</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isDeleting ? (
                <span>Đang xóa...</span>
              ) : (
                <span>Xóa vĩnh viễn khỏi hệ thống</span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="w-full py-2 px-4 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
