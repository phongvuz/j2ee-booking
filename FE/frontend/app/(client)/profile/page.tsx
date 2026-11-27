import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/auth/ProfileForm";

export const metadata = { title: "Hồ sơ cá nhân | Nhà xe Sài Gòn" };

export default async function ProfilePage() {
  const session = await getCurrentCustomer();
  if (!session) redirect("/login?next=/profile");
  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: { name: true, email: true, phone: true, address: true },
  });
  if (!customer) redirect("/login?next=/profile");
  return <div className="max-w-4xl mx-auto px-4 py-10">
    <h1 className="text-3xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
    <p className="mt-2 mb-8 text-gray-500">Quản lý thông tin cá nhân và mật khẩu của bạn.</p>
    <ProfileForm customer={customer} />
  </div>;
}
