import { apiError } from "@/lib/admin-api";
import { getPaymentStatus } from "@/services/paymentService";

export async function GET(request: Request) {
  try {
    const pnr = new URL(request.url).searchParams.get("pnr")?.trim();
    if (!pnr || pnr.length > 191) return Response.json({ success: false, message: "Mã đặt chỗ không hợp lệ." }, { status: 400 });
    return Response.json({ success: true, data: await getPaymentStatus(pnr) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Không thể kiểm tra thanh toán.");
  }
}
