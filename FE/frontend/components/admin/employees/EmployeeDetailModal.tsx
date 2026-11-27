"use client";

import { FiEdit, FiX } from "react-icons/fi";
import Image from "next/image";

import { Employee } from "@/types";

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onEdit: (employee: Employee) => void;
}

export function EmployeeDetailModal({
  isOpen,
  onClose,
  employee,
  onEdit,
}: EmployeeDetailModalProps) {
  if (!isOpen || !employee) return null;

  let statusClassName = "bg-rose-500/20 text-rose-300 border border-rose-500/30";
  if (employee.status === "Đang làm việc") {
    statusClassName = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  } else if (employee.status === "Nghỉ phép") {
    statusClassName = "bg-amber-500/20 text-amber-300 border border-amber-500/30";
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white relative">
          <button
            aria-label="Đóng"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </button>

          <div className="flex items-center gap-4">
            <Image
              width={64}
              height={64}
              unoptimized
              src={
                employee.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  employee.name
                )}&background=ef5222&color=fff&size=150`
              }
              alt={employee.name}
              className="w-16 h-16 rounded-full border-2 border-white/80 object-cover shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{employee.name}</h3>
                <span className="text-xs bg-brand-primary px-2 py-0.5 rounded font-mono font-medium">
                  {employee.id}
                </span>
              </div>
              <p className="text-sm text-slate-300">
                {employee.role} • {employee.department}
              </p>
              <div className="mt-1">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusClassName}`}
                >
                  {employee.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Information Grid */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-500 block mb-0.5">Số điện thoại</span>
              <span className="font-semibold text-gray-900">{employee.phone}</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-500 block mb-0.5">Email</span>
              <span className="font-semibold text-gray-900 truncate block">
                {employee.email}
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-500 block mb-0.5">Số CCCD / CMND</span>
              <span className="font-semibold text-gray-900">
                {employee.identityCard || "Chưa cập nhật"}
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-500 block mb-0.5">
                Ngày bắt đầu làm việc
              </span>
              <span className="font-semibold text-gray-900">
                {employee.startDate || "N/A"}
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl col-span-2">
              <span className="text-xs text-gray-500 block mb-0.5">Địa chỉ</span>
              <span className="font-semibold text-gray-900">
                {employee.address || "Chưa cập nhật"}
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl col-span-2">
              <span className="text-xs text-gray-500 block mb-0.5">Thời gian tạo hồ sơ</span>
              <span className="text-xs font-mono text-gray-700">
                {new Date(employee.createdAt).toLocaleString("vi-VN")}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(employee);
              }}
              className="px-4 py-2 text-sm font-semibold bg-brand-primary hover:bg-brand-dark text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span><FiEdit aria-hidden="true" className="inline-block shrink-0 align-middle" /></span> Chỉnh sửa thông tin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
