import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <span className="text-2xl">🚌</span>
          <span className="font-bold text-lg tracking-tight text-[#ef5222]">ADMIN PORTAL</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/admin" className="block px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            📊 Bảng điều khiển
          </Link>
          <Link href="/admin/buses" className="block px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            🚐 Quản lý Xe
          </Link>
          <Link href="/admin/employees" className="block px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            👥 Quản lý Nhân viên
          </Link>
          <Link href="/admin/orders" className="block px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            🎫 Quản lý Đơn hàng
          </Link>
          <div className="pt-4 mt-4 border-t border-slate-800">
            <Link href="/" className="block px-4 py-3 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              &larr; Về trang chủ
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="md:hidden font-bold text-[#ef5222]">NHAXESAIGON ADMIN</div>
          <div className="hidden md:block text-gray-500 font-medium">Hệ thống Quản lý Nhà xe Sài Gòn</div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#ef5222] text-white rounded-full flex items-center justify-center font-bold">
              A
            </div>
            <span className="font-medium text-gray-700 hidden sm:block">Admin User</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
