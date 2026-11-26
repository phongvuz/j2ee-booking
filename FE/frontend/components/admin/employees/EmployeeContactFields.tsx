import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { EmployeeFormValues } from "@/lib/validations/employee";

interface Props {
  register: UseFormRegister<EmployeeFormValues>;
  errors: FieldErrors<EmployeeFormValues>;
}

export function EmployeeContactFields({ register, errors }: Props) {
  return (
    <>
      {/* Họ và tên */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Họ và Tên <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Nguyễn Văn A"
          {...register("name")}
          className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.name
              ? "border-rose-400 focus:ring-rose-200 bg-rose-50/30"
              : "border-gray-300 focus:ring-orange-200 focus:border-brand-primary"
          }`}
        />
        {errors.name && (
          <p className="text-xs text-rose-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Email công việc <span className="text-rose-500">*</span>
        </label>
        <input
          type="email"
          placeholder="nhanvien@nhaxe.vn"
          {...register("email")}
          className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.email
              ? "border-rose-400 focus:ring-rose-200 bg-rose-50/30"
              : "border-gray-300 focus:ring-orange-200 focus:border-brand-primary"
          }`}
        />
        {errors.email && (
          <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      {/* Số điện thoại */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Số điện thoại <span className="text-rose-500">*</span>
        </label>
        <input
          type="tel"
          placeholder="0901234567"
          {...register("phone")}
          className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.phone
              ? "border-rose-400 focus:ring-rose-200 bg-rose-50/30"
              : "border-gray-300 focus:ring-orange-200 focus:border-brand-primary"
          }`}
        />
        {errors.phone && (
          <p className="text-xs text-rose-500 mt-1">{errors.phone.message}</p>
        )}
      </div>

      {/* Số CCCD / CMND */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Số CCCD / CMND
        </label>
        <input
          type="text"
          placeholder="079201001234"
          {...register("identityCard")}
          className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.identityCard
              ? "border-rose-400 focus:ring-rose-200 bg-rose-50/30"
              : "border-gray-300 focus:ring-orange-200 focus:border-brand-primary"
          }`}
        />
        {errors.identityCard && (
          <p className="text-xs text-rose-500 mt-1">
            {errors.identityCard.message}
          </p>
        )}
      </div>
    </>
  );
}
