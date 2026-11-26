"use client";

import { FaSpinner } from "react-icons/fa";
import { FiEdit, FiPlus, FiX } from "react-icons/fi";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { employeeSchema, EmployeeFormValues } from "@/lib/validations/employee";
import type { Employee } from "@/types";
import { EmployeeContactFields } from "./EmployeeContactFields";
import { EmployeeWorkFields } from "./EmployeeWorkFields";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EmployeeFormValues) => Promise<{ success: boolean; message?: string }>;
  initialData?: Employee | null;
  mode: "create" | "edit";
}

const DEFAULT_VALUES: EmployeeFormValues = {
  name: "",
  email: "",
  phone: "",
  role: "Tài xế",
  department: "Đội xe",
  status: "Đang làm việc",
  identityCard: "",
  address: "",
  startDate: new Date().toISOString().slice(0, 10),
};

export function EmployeeModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: EmployeeModalProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Pre-populate fields on edit mode or reset on create
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        reset({
          name: initialData.name,
          email: initialData.email,
          phone: initialData.phone,
          role: initialData.role,
          department: initialData.department,
          status: (initialData.status as EmployeeFormValues["status"]) || "Đang làm việc",
          identityCard: initialData.identityCard || "",
          address: initialData.address || "",
          startDate: initialData.startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        });
      } else {
        reset(DEFAULT_VALUES);
      }
    }
  }, [isOpen, mode, initialData, reset]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  async function handleFormSubmit(data: EmployeeFormValues) {
    const result = await onSubmit(data);
    if (result.success) {
      onClose();
    }
  }

  function renderSubmitContent() {
    if (isSubmitting) {
      return (
        <>
          <FaSpinner aria-hidden="true" className="animate-spin h-4 w-4 text-white" />
          <span>Đang lưu...</span>
        </>
      );
    }
    if (mode === "create") {
      return "Thêm nhân viên";
    }
    return "Lưu thay đổi";
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center font-bold text-lg">
              {mode === "create" ? <FiPlus aria-hidden="true" className="inline-block shrink-0 align-middle" /> : <FiEdit aria-hidden="true" className="inline-block shrink-0 align-middle" />}
            </span>
            <div>
              <h2 className="text-lg font-bold">
                {mode === "create" ? "Thêm nhân viên mới" : "Chỉnh sửa thông tin nhân viên"}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === "create"
                  ? "Điền thông tin bên dưới để tạo hồ sơ nhân viên trong hệ thống"
                  : `Đang cập nhật hồ sơ: ${initialData?.name} (${initialData?.id})`}
              </p>
            </div>
          </div>
          <button
            aria-label="Đóng"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmployeeContactFields register={register} errors={errors} />
            <EmployeeWorkFields register={register} errors={errors} control={control} />
          </div>

          {/* Địa chỉ */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Địa chỉ liên hệ
            </label>
            <input
              type="text"
              placeholder="VD: Quận 1, TP. Hồ Chí Minh"
              {...register("address")}
              className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-brand-primary transition-colors"
            />
            {errors.address && (
              <p className="text-xs text-rose-500 mt-1">{errors.address.message}</p>
            )}
          </div>

          <p className="text-xs text-gray-500">Hồ sơ nhân viên dùng để quản lý nhân sự. Tài khoản quản trị được tạo tại mục Tài khoản.</p>

          {/* Modal Actions Footer */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold bg-brand-primary hover:bg-brand-dark text-white rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {renderSubmitContent()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
