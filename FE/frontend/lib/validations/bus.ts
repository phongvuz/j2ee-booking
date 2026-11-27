import { getDepartureDayRange } from "@/lib/trip-search";
import { z } from "zod";

export const busSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(5, "Biển số xe phải có ít nhất 5 ký tự")
    .max(20, "Biển số xe không quá 20 ký tự")
    .regex(/^[0-9]{2}[A-Z]{1,2}-[0-9]{3,5}(\.[0-9]{2})?$/i, "Biển số xe không đúng định dạng (VD: 51B-123.45 hoặc 29B-99988)"),
  type: z
    .string()
    .trim()
    .min(2, "Vui lòng chọn hoặc nhập loại xe"),
  capacity: z.coerce
    .number()
    .int("Số ghế phải là số nguyên")
    .min(1, "Số lượng ghế phải từ 1 trở lên")
    .max(60, "Số lượng ghế không vượt quá 60"),
  status: z.enum(["Đang hoạt động", "Bảo dưỡng", "Ngừng hoạt động"], {
    message: "Trạng thái không hợp lệ",
  }),
  brand: z
    .string()
    .trim()
    .max(100, "Tên hãng xe không quá 100 ký tự")
    .optional()
    .or(z.literal("")),
  year: z.union([z.literal("").transform(() => null), z.coerce
    .number().int()
    .min(2000, "Năm sản xuất từ năm 2000 trở đi")
    .max(new Date().getFullYear() + 1, "Năm sản xuất không hợp lệ")
    .optional()
    .nullable()]),
  driverName: z
    .string()
    .trim()
    .max(100, "Tên tài xế không quá 100 ký tự")
    .optional()
    .or(z.literal("")),
  driverPhone: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(val),
      "Số điện thoại tài xế không hợp lệ (VD: 0901234567)"
    )
    .optional()
    .or(z.literal("")),
  lastMaintenance: z
    .string()
    .refine((value) => !value || !!getDepartureDayRange(value), "Ngày bảo dưỡng không hợp lệ")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(500, "Ghi chú không quá 500 ký tự")
    .optional()
    .or(z.literal("")),
});

export type BusFormValues = z.infer<typeof busSchema>;
