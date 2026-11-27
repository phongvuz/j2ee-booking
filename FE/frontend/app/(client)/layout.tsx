import { FaFacebook, FaInstagram, FaYoutube } from "react-icons/fa";
import { FiNavigation, FiSearch } from "react-icons/fi";
import Link from "next/link";
import { Suspense } from "react";
import CustomerMenu from "@/components/auth/CustomerMenu";
import AuthModal from "@/components/auth/AuthModal";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-brand-bg text-brand-text flex flex-col min-h-screen font-sans selection:bg-brand-primary selection:text-white">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-brand-light sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-dark text-white flex items-center justify-center shadow-md shadow-teal-900/10 group-hover:scale-105 transition-transform">
                <FiNavigation aria-hidden="true" className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-black text-2xl tracking-wider text-brand-primary leading-none">
                  NOMAD
                </span>
                <span className="text-[11px] font-medium tracking-tight text-slate-500 mt-1">
                  Cùng bạn đi xa hơn
                </span>
              </div>
            </Link>

            {/* Quick search bar (center) */}
            <div className="hidden lg:flex items-center flex-1 max-w-xs mx-6">
              <form action="/trips" className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FiSearch aria-hidden="true" className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  name="to"
                  placeholder="Bạn muốn đi đâu?"
                  className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-[#DEECE5] rounded-full text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:bg-white transition-all"
                />
              </form>
            </div>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-slate-700">
              <Link href="/" className="hover:text-brand-primary transition-colors">
                Trang chủ
              </Link>
              <Link href="/trips" className="hover:text-brand-primary transition-colors">
                Lịch trình
              </Link>
              <Link href="/#destinations" className="hover:text-brand-primary transition-colors">
                Điểm đến
              </Link>
              <Link href="/#guides" className="hover:text-brand-primary transition-colors">
                Cẩm nang
              </Link>
              <Link href="/lookup" className="hover:text-brand-primary transition-colors">
                Tra cứu vé
              </Link>
            </nav>

            {/* Auth / Profile Area */}
            <div className="flex items-center gap-3">
              <Suspense fallback={<span className="text-xs text-slate-400">Đang tải...</span>}>
                <CustomerMenu />
              </Suspense>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>
\
      <footer className="relative bg-brand-dark text-slate-200 mt-20 pt-16 pb-12 overflow-hidden">
        {/* Organic Wave Top Divider */}
        <div className="absolute top-0 left-0 right-0 overflow-hidden leading-none pointer-events-none -translate-y-[99%]">
          <svg
            className="relative block w-full h-10 md:h-14 text-brand-dark"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,50 L1200,120 L0,120 Z" />
          </svg>
        </div>

        {/* Ambient background glow and leaf silhouettes */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,94,87,0.4),transparent_50%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8 pb-12 border-b border-emerald-900/60">
            {/* Brand column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center">
                  <FiNavigation aria-hidden="true" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-2xl tracking-wider text-white leading-none">
                    NOMAD
                  </h3>
                  <p className="text-xs text-emerald-200/80 mt-1">Cùng bạn đi xa hơn</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed max-w-sm">
                Nền tảng du lịch và đặt vé xe chất lượng cao. Khám phá vẻ đẹp bất tận trên mọi hành trình khắp Việt Nam.
              </p>

              {/* Social icons */}
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="#"
                  aria-label="Facebook"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all"
                >
                  <FaFacebook aria-hidden="true" className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  aria-label="Instagram"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all"
                >
                  <FaInstagram aria-hidden="true" className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  aria-label="YouTube"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all"
                >
                  <FaYoutube aria-hidden="true" className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Column 1: Điểm đến */}
            <div className="space-y-3">
              <h4 className="text-white font-semibold text-sm tracking-wide">Điểm đến</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li><Link href="/trips?to=HAN" className="hover:text-white transition-colors">Miền Bắc</Link></li>
                <li><Link href="/trips?to=DAD" className="hover:text-white transition-colors">Miền Trung</Link></li>
                <li><Link href="/trips?to=SGN" className="hover:text-white transition-colors">Miền Nam</Link></li>
                <li><Link href="/trips?to=DLT" className="hover:text-white transition-colors">Đà Lạt</Link></li>
                <li><Link href="/trips?to=NHA" className="hover:text-white transition-colors">Nha Trang</Link></li>
              </ul>
            </div>

            {/* Column 2: Trải nghiệm */}
            <div className="space-y-3">
              <h4 className="text-white font-semibold text-sm tracking-wide">Trải nghiệm</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li><Link href="/trips" className="hover:text-white transition-colors">Tour du lịch</Link></li>
                <li><Link href="/trips" className="hover:text-white transition-colors">Hoạt động bản địa</Link></li>
                <li><Link href="/trips" className="hover:text-white transition-colors">Ẩm thực vùng miền</Link></li>
                <li><Link href="/trips" className="hover:text-white transition-colors">Vé xe Limousine</Link></li>
              </ul>
            </div>

            {/* Column 3: Cẩm nang */}
            <div className="space-y-3">
              <h4 className="text-white font-semibold text-sm tracking-wide">Cẩm nang</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li><Link href="/#guides" className="hover:text-white transition-colors">Kinh nghiệm du lịch</Link></li>
                <li><Link href="/#guides" className="hover:text-white transition-colors">Gợi ý lịch trình</Link></li>
                <li><Link href="/#guides" className="hover:text-white transition-colors">Checklist chuẩn bị</Link></li>
                <li><Link href="/#guides" className="hover:text-white transition-colors">Mẹo tiết kiệm</Link></li>
              </ul>
            </div>

            {/* Column 4: Hỗ trợ */}
            <div className="space-y-3">
              <h4 className="text-white font-semibold text-sm tracking-wide">Hỗ trợ</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li><Link href="/lookup" className="hover:text-white transition-colors">Tra cứu đơn vé</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Liên hệ 24/7</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Câu hỏi thường gặp</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Chính sách bảo mật</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Điều khoản dịch vụ</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-emerald-200/70">
            <p>© {new Date().getFullYear()} NOMAD • Nhà xe Sài Gòn. Cùng bạn đi xa hơn.</p>
            <p>Hotline hỗ trợ: <span className="font-semibold text-white">1900 1234</span> (24/7)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
