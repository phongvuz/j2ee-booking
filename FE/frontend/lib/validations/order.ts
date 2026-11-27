import { z } from "zod";
import { tripIdSchema } from "@/lib/trip-id";
import { realtimeClientIdSchema } from "@/lib/validations/seat-realtime";

export const offlineOrderSchema = z.object({
  tripId: tripIdSchema,
  seats: z.array(z.string().trim().min(1).max(5)).min(1, "Vui lòng chọn ít nhất 1 ghế").max(5, "Mỗi lượt đặt tối đa 5 ghế"),
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên khách hàng tối thiểu 2 ký tự")
    .max(100, "Họ tên khách hàng tối đa 100 ký tự"),
  phone: z
    .string()
    .trim()
    .regex(
      /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/,
      "Số điện thoại không hợp lệ (VD: 0901234567)"
    ),
  status: z.enum(["CONFIRMED", "PENDING"]).default("CONFIRMED"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]).default("CASH"),
});

export const onlineOrderSchema = offlineOrderSchema.omit({ status: true, paymentMethod: true }).extend({
  clientId: realtimeClientIdSchema.optional(),
});

export type OfflineOrderFormValues = z.infer<typeof offlineOrderSchema>;
