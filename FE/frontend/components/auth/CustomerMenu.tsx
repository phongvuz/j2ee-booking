import AuthLink from "./AuthLink";
import { getCurrentAdmin, getCurrentCustomer } from "@/lib/session";
import CustomerDropdown from "./CustomerDropdown";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default async function CustomerMenu() {
  const customer = await getCurrentCustomer();
  if (customer) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Xin chào, {customer.name}</span>
        <CustomerDropdown />
      </div>
    );
  }
  const admin = await getCurrentAdmin();
  if (admin) {
    return <div className="flex items-center gap-3 text-sm">
      <Link href="/admin" className="font-semibold text-brand-primary hover:underline">Trang quản trị</Link>
      <LogoutButton audience="admin" />
    </div>;
  }
  return (
    <div className="flex items-center gap-3">
      <AuthLink
        mode="login"
        className="text-sm font-medium text-slate-600 hover:text-brand-primary transition-colors"
      >
        Đăng nhập
      </AuthLink>
      <AuthLink
        mode="register"
        className="bg-brand-primary hover:bg-brand-dark text-white text-sm font-medium py-2 px-5 rounded-full transition-all shadow-sm hover:shadow"
      >
        Đăng ký
      </AuthLink>
    </div>
  );
}
