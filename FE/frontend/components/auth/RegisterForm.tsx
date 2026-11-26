"use client";

import { FiAlertTriangle } from "react-icons/fi";
import { useRef, useState } from "react";
import { registerSchema } from "@/lib/validations/register";

export default function RegisterForm({ onLogin, onSuccess }: {
  onLogin: () => void;
  onSuccess: (redirectTo: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setError("");

    const parsed = registerSchema.safeParse(formData);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    submitting.current = true;
    setIsPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message || "Đăng ký thất bại. Vui lòng thử lại!");
        return;
      }
      setFormData((current) => ({ ...current, password: "", confirmPassword: "" }));
      onSuccess(result.redirectTo);
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại!");
    } finally {
      submitting.current = false;
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={isPending} className="mt-6 space-y-4">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-2">
          <span><FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
          <span>{error}</span>
        </div>
      )}

      {/* Họ và tên */}
      <div>
        <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-1">
          Họ và tên <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          placeholder="Nguyễn Văn A"
          maxLength={191}
          id="fullName"
          name="fullName"
          autoComplete="name"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 text-sm"
        />
      </div>

      {/* Số điện thoại */}
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1">
          Số điện thoại <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          required
          pattern="0[0-9]{9}"
          maxLength={10}
          inputMode="numeric"
          placeholder="0912345678"
          id="phone"
          name="phone"
          autoComplete="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 text-sm"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          required
          maxLength={191}
          placeholder="example@gmail.com"
          id="email"
          name="email"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 text-sm"
        />
      </div>

      {/* Địa chỉ */}
      <div>
        <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-1">
          Địa chỉ
        </label>
        <input
          id="address"
          name="address"
          type="text"
          autoComplete="street-address"
          maxLength={191}
          placeholder="Nhập địa chỉ của bạn"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 text-sm"
        />
      </div>

      {/* Mật khẩu */}
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
          Mật khẩu <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            placeholder="Tối thiểu 6 ký tự"
            minLength={6}
          maxLength={128}
          id="password"
          name="password"
          autoComplete="new-password"
          value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 pr-12 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600"
          >
            {showPassword ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </div>

      {/* Xác nhận mật khẩu */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1">
          Nhập lại mật khẩu <span className="text-red-500">*</span>
        </label>
        <input
          type={showPassword ? "text" : "password"}
          required
          placeholder="Nhập lại mật khẩu phía trên"
          minLength={6}
          maxLength={128}
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 text-sm"
        />
      </div>

      {/* Checkbox điều khoản */}
      <div className="flex items-center gap-2 pt-1">
        <input
          id="terms"
          type="checkbox"
          checked={formData.agreeTerms}
          onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
          required
          className="w-4 h-4 text-brand-primary accent-brand-primary rounded cursor-pointer"
        />
        <label htmlFor="terms" className="text-xs text-gray-600 cursor-pointer">
          Tôi đồng ý với{" "}
          <span className="text-brand-primary font-medium">
            Điều khoản dịch vụ & Chính sách bảo mật
          </span>
        </label>
      </div>

      <p className="text-xs text-gray-500">Vé đã đặt khi chưa đăng nhập được tra cứu bằng mã đặt chỗ (PNR) và số điện thoại hành khách.</p>

      {/* Nút submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-2 bg-brand-primary hover:bg-brand-dark disabled:bg-orange-300 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 shadow-md cursor-pointer disabled:cursor-not-allowed text-sm"
      >
        {isPending ? "Đang tạo tài khoản..." : "Đăng ký tài khoản"}
      </button>

      <div className="text-center text-sm text-gray-500 pt-3 border-t">
        Đã có tài khoản?{" "}
        <button type="button" onClick={onLogin} disabled={isPending} className="cursor-pointer font-bold text-brand-primary hover:underline">
          Đăng nhập
        </button>
      </div>
    </form>
  );
}
