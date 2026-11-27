import { requireAdmin } from "@/lib/admin-api";
import AdminShell from "@/components/admin/AdminShell";

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Layout chạy trên máy chủ và kiểm tra quyền trước khi hiển thị trang admin.
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const admin = await requireAdmin();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
