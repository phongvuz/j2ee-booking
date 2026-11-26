"use client";

import Link from "next/link";
import { FaSpinner } from "react-icons/fa";
import { FiAlertTriangle } from "react-icons/fi";
import { useRef, useState } from "react";

export default function LoginForm({ onSuccess, onRegister, variant = "customer" }: {
  onSuccess: (redirectTo: string) => void;
  onRegister?: () => void;
  variant?: "customer" | "admin";
}) {
  const isAdmin = variant === "admin";
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setError("");

    if (!email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    submitting.current = true;
    setIsPending(true);
    let navigationStarted = false;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email.trim(), password, audience: variant }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || "Không thể đăng nhập. Vui lòng thử lại!");
        return;
      }
      onSuccess(data.redirectTo);
      navigationStarted = true;
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại!");
    } finally {
      // Keep the form locked until the authenticated destination replaces this page.
      if (!navigationStarted) {
        submitting.current = false;
        setIsPending(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={isPending} className="mt-8 space-y-5">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <span><FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="login-identifier" className="block text-sm font-semibold text-gray-700 mb-1">
          {isAdmin ? "Số điện thoại" : "Email hoặc Số điện thoại"}
        </label>
        <input
          id="login-identifier"
          name="email"
          autoComplete="username"
          maxLength={isAdmin ? 10 : 191}
          type={isAdmin ? "tel" : "text"}
          pattern={isAdmin ? "0[0-9]{9}" : undefined}
          required
          disabled={isPending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={isAdmin ? "Nhập số điện thoại quản trị viên" : "Nhập email hoặc số điện thoại"}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 text-sm"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="login-password" className="block text-sm font-semibold text-gray-700">
            Mật khẩu
          </label>
        </div>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            autoComplete="current-password"
            maxLength={128}
            type={showPassword ? "text" : "password"}
            required
            disabled={isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-gray-50/50 focus:bg-white text-gray-800 pr-12 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            {showPassword ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand-primary hover:bg-brand-dark disabled:bg-orange-300 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed text-sm"
      >
        {isPending ? (
          <>
            <FaSpinner aria-hidden="true" className="animate-spin h-5 w-5 text-white" />
            <span>Đang đăng nhập...</span>
          </>
        ) : (
          "Đăng nhập"
        )}
      </button>

      {!isAdmin && onRegister && <div className="text-center text-sm text-gray-500 pt-2 border-t">
        Chưa có tài khoản?{" "}
        <button
          type="button"
          onClick={onRegister}
          disabled={isPending}
          className="cursor-pointer font-bold text-brand-primary hover:underline"
        >
          Đăng ký ngay
        </button>
      </div>}
      {!isAdmin && <p className="text-center text-sm text-gray-500">
        Bạn là quản trị viên?{" "}
        <Link href="/admin/login" className="font-bold text-brand-primary hover:underline">
          Đăng nhập quản trị
        </Link>
      </p>}
    </form>
  );
}
