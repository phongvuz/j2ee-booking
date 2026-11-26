"use client";

import { FaBus, FaRoad, FaTicketAlt } from "react-icons/fa";
import { FiArrowLeft, FiBarChart2, FiCreditCard, FiMenu, FiUser, FiUsers, FiX } from "react-icons/fi";
import type { IconType } from "react-icons";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ToastProvider } from "@/components/admin/Toast";

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Bảng điều khiển", icon: FiBarChart2, exact: true },
  { href: "/admin/trips", label: "Quản lý Chuyến xe", icon: FaRoad },
  { href: "/admin/orders", label: "Quản lý Đơn hàng", icon: FaTicketAlt },
  { href: "/admin/payments", label: "Thu / hoàn tiền", icon: FiCreditCard },
  { href: "/admin/buses", label: "Quản lý Xe", icon: FaBus },
  { href: "/admin/employees", label: "Quản lý Nhân viên", icon: FiUsers },
  { href: "/admin/users", label: "Quản lý Tài khoản", icon: FiUser },
];

export default function AdminShell({
  children, admin,
}: {
  children: React.ReactNode;
  admin: { fullName: string; phone: string };
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function isActive(item: NavItem) {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shrink-0 border-r border-slate-800">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-2xl"><FaBus aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
              <span className="font-extrabold text-lg tracking-tight text-brand-primary">
                ADMIN PORTAL
              </span>
            </Link>
          </div>

          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">
              Quản trị hệ thống
            </div>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                    ? "bg-brand-primary text-white shadow-sm font-semibold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                    }`}
                >
                  <item.icon aria-hidden="true" className="text-lg shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-800">
              <Link
                href="/"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <span><FiArrowLeft aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
                <span>Về trang đặt vé</span>
              </Link>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{admin.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{admin.phone}</p>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Backdrop & Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 flex flex-col md:hidden transition-transform duration-300 ease-in-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl"><FaBus aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
              <span className="font-bold text-lg text-brand-primary">ADMIN PORTAL</span>
            </div>
            <button
              aria-label="Đóng"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded"
            >
              <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                    ? "bg-brand-primary text-white shadow-sm font-semibold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                    }`}
                >
                  <item.icon aria-hidden="true" className="text-lg shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-4 mt-4 border-t border-slate-800">
              <Link
                href="/"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <span><FiArrowLeft aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
                <span>Về trang chủ</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
                aria-label="Mở menu"
              >
                <FiMenu aria-hidden="true" className="inline-block shrink-0 align-middle" />
              </button>
              <div className="font-bold text-brand-primary md:hidden">NHAXESAIGON</div>
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 font-medium">
                <span>Trang quản trị vận tải</span>
                <span className="text-gray-300">/</span>
                <span className="text-gray-800 font-semibold">
                  {NAV_ITEMS.find((n) => isActive(n))?.label || "Bảng điều khiển"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <LogoutButton redirectTo="/admin/login" />
              <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center font-bold text-xs shadow-xs">
                A
              </div>
              <span className="font-semibold text-xs sm:text-sm text-gray-700 hidden sm:block">
                {admin.fullName}
              </span>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
