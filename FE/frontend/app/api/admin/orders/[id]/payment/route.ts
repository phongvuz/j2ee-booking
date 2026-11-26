import { z } from "zod";
import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { parseTripId } from "@/lib/trip-id";
import { receiveBookingPayment, refundBookingPayment } from "@/services/bookingFinanceService";

const schema = z.object({
  kind: z.enum(["RECEIPT", "REFUND"]),
  method: z.enum(["CASH", "BANK_TRANSFER"]),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const id = parseTripId((await params).id);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return Response.json({ success: false, message: "Chọn thao tác thu/hoàn và phương thức hợp lệ." }, { status: 400 });
    const { kind, method } = parsed.data;
    const changed = kind === "RECEIPT"
      ? await receiveBookingPayment(id, method, admin.id)
      : await refundBookingPayment(id, method, admin.id);
    if (!changed) return Response.json({ success: false, message: "Không tìm thấy vé." }, { status: 404 });
    return Response.json({ success: true, message: kind === "RECEIPT" ? "Đã ghi nhận thu tiền." : "Đã ghi nhận hoàn tiền." });
  } catch (error) {
    return apiError(error, "Không thể ghi nhận thu/hoàn tiền.");
  }
}
