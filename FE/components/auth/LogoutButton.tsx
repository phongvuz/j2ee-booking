"use client";

import { useRef, useState } from "react";

type LogoutButtonProps = {
  className?: string;
  redirectTo?: "/" | "/admin/login";
  audience?: "admin" | "customer";
};

export default function LogoutButton({
  className = "font-medium text-brand-primary disabled:opacity-50",
  redirectTo = "/",
  audience = redirectTo === "/admin/login" ? "admin" : "customer",
}: LogoutButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function logout() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/logout?audience=${audience}`, { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      window.location.replace(redirectTo);
    } catch {
      setError("Không thể đăng xuất. Vui lòng thử lại!");
      submitting.current = false;
      setPending(false);
    }
  }
  return <div>
    <button type="button" onClick={logout} disabled={pending} aria-busy={pending} className={className}>{pending ? "Đang đăng xuất..." : "Đăng xuất"}</button>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
