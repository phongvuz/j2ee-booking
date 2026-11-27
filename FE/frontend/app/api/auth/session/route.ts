import { NextResponse } from "next/server";
import { getCurrentCustomer, getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = await getCurrentUser();
    const customer = account?.role === "CUSTOMER" ? await getCurrentCustomer() : null;
    const authenticated = account?.role === "ADMIN" || Boolean(customer);
    const response = NextResponse.json({
      authenticated,
      user: authenticated && account ? {
        id: account.id, name: customer?.name ?? account.fullName, role: account.role,
      } : null,
    }, { headers: { "Cache-Control": "no-store" } });
    // A read must not delete a newer cookie set while this request was in flight.
    return response;
  } catch {
    return NextResponse.json({ message: "Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại!" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
