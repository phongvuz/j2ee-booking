import { redirect } from "next/navigation";
import { safeAuthReturnTo } from "@/lib/auth-navigation";

export const metadata = {
  title: "Đăng ký tài khoản | Nhà xe Sài Gòn",
  description: "Tạo tài khoản để đặt vé và quản lý lịch trình dễ dàng",
};

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const returnTo = safeAuthReturnTo(typeof next === "string" ? next : null);
  const params = new URLSearchParams({ auth: "register" });
  if (returnTo) params.set("next", returnTo);
  redirect(`/?${params}`);
}
