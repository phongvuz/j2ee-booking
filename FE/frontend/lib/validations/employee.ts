import { getDepartureDayRange } from "@/lib/trip-search";
import { z } from "zod";

export const employeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự")
    .max(100, "Họ và tên không được quá 100 ký tự"),
  email: z
    .string()
    .trim()
    .email("Email không đúng định dạng (VD: nhanvien@nhaxe.vn)").max(191),
  phone: z
    .string()
    .trim()
    .regex(
      /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/,
      "Số điện thoại di động không hợp lệ (VD: 0901234567)"
    ),
  role: z.string().trim().max(191).min(1, "Vui lòng chọn chức vụ/vai trò"),
  department: z.string().trim().max(191).min(1, "Vui lòng chọn phòng ban"),
  status: z.enum(["Đang làm việc", "Nghỉ phép", "Đã nghỉ việc"], {
    message: "Trạng thái không hợp lệ",
  }),
  identityCard: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^(?:[0-9]{9}|[0-9]{12})$/.test(val),
      "Số CCCD/CMND phải là 9 hoặc 12 chữ số"
    )
    .optional(),
  address: z
    .string()
    .trim()
    .max(191, "Địa chỉ không quá 191 ký tự")
    .optional(),
  startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu làm việc")
    .refine((value) => !!getDepartureDayRange(value), "Ngày bắt đầu không hợp lệ"),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
