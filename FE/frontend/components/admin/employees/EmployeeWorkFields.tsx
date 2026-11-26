import { FaCircle } from "react-icons/fa";
import { useWatch, type Control, type UseFormRegister, type FieldErrors } from "react-hook-form";
import type { EmployeeFormValues } from "@/lib/validations/employee";

interface Props {
  register: UseFormRegister<EmployeeFormValues>;
  errors: FieldErrors<EmployeeFormValues>;
  control: Control<EmployeeFormValues>;
}

export function EmployeeWorkFields({ register, errors, control }: Props) {
  const status = useWatch({ control, name: "status" });
  let statusDotClassName = "text-rose-500";
  if (status === "Đang làm việc") {
    statusDotClassName = "text-emerald-500";
  } else if (status === "Nghỉ phép") {
    statusDotClassName = "text-amber-500";
  }

  return (
    <>
      {/* Vai trò / Chức vụ */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Vai trò / Chức vụ <span className="text-rose-500">*</span>
        </label>
        <select
          {...register("role")}
          className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 bg-white transition-colors cursor-pointer ${errors.role
            ? "border-rose-400 focus:ring-rose-200 bg-rose-50/30"
            : "border-gray-300 focus:ring-orange-200 focus:border-brand-primary"
            }`}
        >
          <option value="Tài xế">Tài xế</option>
          <option value="Phụ xe">Phụ xe</option>
          <option value="Văn phòng">Văn phòng</option>
          <option value="Quản lý">Quản lý</option>
          <option value="Điều hành">Điều hành</option>
        </select>
        {errors.role && (
          <p className="text-xs text-rose-500 mt-1">{errors.role.message}</p>
        )}
      </div>

      {/* Phòng ban */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Phòng ban <span className="text-rose-500">*</span>
        </label>
        <select
          {...register("department")}
          className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 bg-white transition-colors cursor-pointer ${errors.department
            ? "border-rose-400 focus:ring-rose-200 bg-rose-50/30"
            : "border-gray-300 focus:ring-orange-200 focus:border-brand-primary"
            }`}
        >
          <option value="Đội xe">Đội xe</option>
          <option value="Phòng vé">Phòng vé</option>
          <option value="Ban điều hành">Ban điều hành</option>
          <option value="Kế toán">Kế toán</option>
          <option value="Kỹ thuật & Bảo dưỡng">Kỹ thuật & Bảo dưỡng</option>
        </select>
        {errors.department && (
          <p className="text-xs text-rose-500 mt-1">
            {errors.department.message}
          </p>
        )}
      </div>

      {/* Trạng thái làm việc */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Trạng thái làm việc
        </label>
        <div className="relative">
          <FaCircle
            aria-hidden="true"
            className={`pointer-events-none absolute left-3.5 top-1/2 h-2 w-2 -translate-y-1/2 ${statusDotClassName}`}
          />
          <select
            {...register("status")}
            className="w-full pl-8 pr-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-brand-primary bg-white transition-colors cursor-pointer"
          >
            <option value="Đang làm việc">Đang làm việc</option>
            <option value="Nghỉ phép">Nghỉ phép</option>
            <option value="Đã nghỉ việc">Đã nghỉ việc</option>
          </select>
        </div>
        {errors.status && (
          <p className="text-xs text-rose-500 mt-1">{errors.status.message}</p>
        )}
      </div>

      {/* Ngày vào làm */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Ngày bắt đầu làm việc <span className="text-rose-500">*</span>
        </label>
        <input
          type="date"
          {...register("startDate")}
          className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.startDate
            ? "border-rose-400 focus:ring-rose-200 bg-rose-50/30"
            : "border-gray-300 focus:ring-orange-200 focus:border-brand-primary"
            }`}
        />
        {errors.startDate && (
          <p className="text-xs text-rose-500 mt-1">{errors.startDate.message}</p>
        )}
      </div>
    </>
  );
}
