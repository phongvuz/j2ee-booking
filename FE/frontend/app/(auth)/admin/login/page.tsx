import Link from "next/link";
import { redirect } from "next/navigation";
import { FiArrowLeft, FiShield } from "react-icons/fi";
import AdminLoginForm from "@/components/auth/AdminLoginForm";
import { getCurrentAdmin } from "@/lib/session";

export const metadata = {
  title: "Đăng nhập quản trị | Nhà xe Sài Gòn",
  description: "Đăng nhập vào hệ thống quản trị Nhà xe Sài Gòn",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");

  return <main>
    <div className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand-primary">
        <FiShield aria-hidden="true" className="h-7 w-7" />
      </span>
      <p className="mt-5 text-xs font-bold tracking-widest text-brand-primary">NHÀ XE SÀI GÒN · ADMIN</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-900">Đăng nhập quản trị</h1>
      <p className="mt-2 text-sm text-gray-500">Dành cho tài khoản quản trị viên đang hoạt động.</p>
    </div>
    <AdminLoginForm />
    <div className="mt-6 border-t border-gray-100 pt-5 text-center">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-brand-primary">
        <FiArrowLeft aria-hidden="true" /> Về trang đặt vé
      </Link>
    </div>
  </main>;
}
