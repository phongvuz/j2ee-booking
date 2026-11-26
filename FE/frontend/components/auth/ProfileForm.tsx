"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Customer = { name: string; email: string; phone: string; address: string | null };
const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-brand-primary focus:ring-2 focus:ring-orange-100";
const buttonClass = "rounded-xl bg-brand-primary px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed";

function AccountForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setMessage("");
    if (!customer && values.password !== values.confirmPassword) {
      setError(true); setMessage("Mật khẩu xác nhận không trùng khớp!"); return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, action: customer ? "profile" : "password" }),
      });
      const data = await response.json();
      setError(!response.ok);
      setMessage(data.message || "Không thể cập nhật. Vui lòng thử lại!");
      if (response.ok) {
        if (!customer) { form.reset(); setShowPassword(false); }
        router.refresh();
      }
    } catch {
      setError(true); setMessage("Không thể kết nối máy chủ. Vui lòng thử lại!");
    } finally { setPending(false); }
  }

  const fields = customer ? [
    { name: "fullName", label: "Họ và tên", type: "text", value: customer.name, autoComplete: "name", max: 191 },
    { name: "email", label: "Email", type: "email", value: customer.email, autoComplete: "email", max: 191 },
    { name: "phone", label: "Số điện thoại", type: "tel", value: customer.phone, autoComplete: "tel", max: 10 },
    { name: "address", label: "Địa chỉ", type: "text", value: customer.address || "", autoComplete: "street-address", max: 191 },
  ] : [
    { name: "currentPassword", label: "Mật khẩu hiện tại", type: showPassword ? "text" : "password", autoComplete: "current-password", max: 128 },
    { name: "password", label: "Mật khẩu mới", type: showPassword ? "text" : "password", autoComplete: "new-password", max: 128 },
    { name: "confirmPassword", label: "Xác nhận mật khẩu mới", type: showPassword ? "text" : "password", autoComplete: "new-password", max: 128 },
  ];

  return <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold mb-5">{customer ? "Thông tin cá nhân" : "Đổi mật khẩu"}</h2>
    <fieldset disabled={pending} className="space-y-5">
      {fields.map((field) => <div key={field.name}>
        <label htmlFor={field.name} className="block mb-2 text-sm font-semibold">{field.label}{field.name === "address" ? " (không bắt buộc)" : ""}</label>
        <input id={field.name} name={field.name} type={field.type} defaultValue={"value" in field ? field.value : undefined}
          autoComplete={field.autoComplete} required={field.name !== "address"} maxLength={field.max}
          minLength={field.name === "password" || field.name === "confirmPassword" ? 6 : undefined}
          pattern={field.name === "phone" ? "0[0-9]{9}" : undefined} className={inputClass} />
      </div>)}
      {!customer && <>
        <p className="text-sm text-gray-500">Mật khẩu mới từ 6 đến 128 ký tự và khác mật khẩu hiện tại.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />Hiện mật khẩu</label>
      </>}
      {message && <p role={error ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</p>}
      <button disabled={pending} type="submit" className={buttonClass}>{pending ? "Đang lưu..." : customer ? "Lưu thay đổi" : "Đổi mật khẩu"}</button>
    </fieldset>
  </form>;
}

export default function ProfileForm({ customer }: { customer: Customer }) {
  return <div className="grid items-start gap-6 md:grid-cols-2"><AccountForm customer={customer} /><AccountForm /></div>;
}
