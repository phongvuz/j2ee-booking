"use client";

import { FiX } from "react-icons/fi";
import type { z } from "zod";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { busSchema, BusFormValues } from "@/lib/validations/bus";
import { Bus } from "@/types";

interface BusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BusFormValues) => Promise<{ success: boolean; message?: string }>;
  initialData?: Bus | null;
  mode: "create" | "edit";
}

// Form nhận giá trị từ input, schema kiểm tra và chuyển sang BusFormValues.
type BusFormInput = z.input<typeof busSchema>;

export function BusModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: BusModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BusFormInput, unknown, BusFormValues>({
    resolver: zodResolver(busSchema),
    defaultValues: {
      plate: "",
      type: "Limousine 22 phòng",
      capacity: 22,
      status: "Đang hoạt động",
      brand: "",
      year: new Date().getFullYear(),
      driverName: "",
      driverPhone: "",
      lastMaintenance: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData && mode === "edit") {
      reset({
        plate: initialData.plate,
        type: initialData.type,
        capacity: initialData.capacity,
        status: initialData.status as BusFormValues["status"],
        brand: initialData.brand || "",
        year: initialData.year ?? "",
        driverName: initialData.driverName || "",
        driverPhone: initialData.driverPhone || "",
        lastMaintenance: initialData.lastMaintenance || "",
        notes: initialData.notes || "",
      });
    } else {
      reset({
        plate: "",
        type: "Limousine 22 phòng",
        capacity: 22,
        status: "Đang hoạt động",
        brand: "",
        year: new Date().getFullYear(),
        driverName: "",
        driverPhone: "",
        lastMaintenance: "",
        notes: "",
      });
    }
  }, [initialData, mode, reset, isOpen]);

  if (!isOpen) return null;

  async function handleFormSubmit(data: BusFormValues) {
    const response = await onSubmit(data);
    if (response.success) {
      onClose();
    }
  }

  let submitLabel = "Lưu thay đổi";
  if (isSubmitting) {
    submitLabel = "Đang lưu...";
  } else if (mode === "create") {
    submitLabel = "Tạo xe mới";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-base">
              {mode === "create" ? "Thêm xe mới" : `Chỉnh sửa xe ${initialData?.plate}`}
            </h3>
            <p className="text-xs text-gray-500">
              {mode === "create"
                ? "Điền thông tin kỹ thuật và tài xế quản lý phương tiện"
                : "Cập nhật dữ liệu kỹ thuật và lịch bảo dưỡng"}
            </p>
          </div>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg p-1 rounded transition-colors"
          >
            <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Biển số & Loại xe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Biển số xe <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: 51B-123.45"
                {...register("plate")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold uppercase focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              {errors.plate && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.plate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Loại xe <span className="text-rose-500">*</span>
              </label>
              <select
                {...register("type")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              >
                {initialData?.type && !["Limousine 22 phòng", "Giường nằm 34 chỗ", "Ghế ngồi 28 chỗ"].includes(initialData.type) && (
                  <option value={initialData.type}>{initialData.type}</option>
                )}
                <option value="Limousine 22 phòng">Limousine 22 phòng</option>
                <option value="Giường nằm 34 chỗ">Giường nằm 34 chỗ</option>
                <option value="Ghế ngồi 28 chỗ">Ghế ngồi 28 chỗ</option>
              </select>
              {errors.type && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.type.message}</p>
              )}
            </div>
          </div>

          {/* Số ghế & Trạng thái */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Số ghế / Phòng <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={60}
                {...register("capacity")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              {errors.capacity && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.capacity.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Trạng thái vận hành <span className="text-rose-500">*</span>
              </label>
              <select
                {...register("status")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              >
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Bảo dưỡng">Bảo dưỡng</option>
                <option value="Ngừng hoạt động">Ngừng hoạt động</option>
              </select>
              {errors.status && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          {/* Hãng xe & Năm sản xuất */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hãng xe / Dòng xe
              </label>
              <input
                type="text"
                placeholder="VD: Thaco Mobihome"
                {...register("brand")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Năm sản xuất
              </label>
              <input
                type="number"
                {...register("year")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Tài xế & SĐT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tài xế phụ trách
              </label>
              <input
                type="text"
                placeholder="Họ tên tài xế"
                {...register("driverName")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Số điện thoại tài xế
              </label>
              <input
                type="text"
                placeholder="VD: 0901234567"
                {...register("driverPhone")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              {errors.driverPhone && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.driverPhone.message}</p>
              )}
            </div>
          </div>

          {/* Ngày bảo dưỡng & Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bảo dưỡng gần nhất
            </label>
            <input
              type="date"
              {...register("lastMaintenance")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Ghi chú bảo dưỡng / tình trạng xe
            </label>
            <textarea
              rows={2}
              placeholder="VD: Cần kiểm tra định kỳ 50,000km..."
              {...register("notes")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
