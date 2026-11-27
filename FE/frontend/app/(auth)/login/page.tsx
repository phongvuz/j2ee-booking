import { redirect } from "next/navigation";
import { safeAuthReturnTo } from "@/lib/auth-navigation";

export const metadata = {
  title: "Đăng nhập | Nhà xe Sài Gòn",
  description: "Đăng nhập hệ thống đặt vé xe Nhà xe Sài Gòn",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const returnTo = safeAuthReturnTo(typeof next === "string" ? next : null);
  if (returnTo === "/admin" || returnTo?.startsWith("/admin/")) redirect("/admin/login");
  const params = new URLSearchParams({ auth: "login" });
  if (returnTo) params.set("next", returnTo);
  redirect(`/?${params}`);
}
