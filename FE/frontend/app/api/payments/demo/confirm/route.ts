import { z } from "zod";
import { apiError, readJson } from "@/lib/admin-api";
import { isSameOriginRequest } from "@/lib/request-origin";
import { confirmDemoPayment } from "@/services/paymentService";

const schema = z.object({ pnr: z.string().trim().min(1).max(191) }).strict();

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ success: false, message: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  try {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return Response.json({ success: false, message: "Mã đặt chỗ không hợp lệ." }, { status: 400 });
    const data = await confirmDemoPayment(parsed.data.pnr);
    return Response.json({ success: true, message: "Đã xác nhận thanh toán giả lập và hoàn tất đặt vé.", data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Không thể xác nhận thanh toán demo. Vui lòng thử lại.");
  }
}
