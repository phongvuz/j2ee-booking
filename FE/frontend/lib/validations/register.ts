import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ và tên!").max(191, "Họ và tên không quá 191 ký tự!"),
  email: z.string().trim().toLowerCase().email("Email không hợp lệ!").max(191, "Email không quá 191 ký tự!"),
  phone: z.string().trim().regex(/^0[0-9]{9}$/, "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0!"),
  address: z.string().trim().max(191, "Địa chỉ không quá 191 ký tự!").optional(),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự!").max(128, "Mật khẩu không quá 128 ký tự!"),
  confirmPassword: z.string(),
  agreeTerms: z.literal(true, { message: "Vui lòng đồng ý với điều khoản dịch vụ!" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không trùng khớp!",
  path: ["confirmPassword"],
});
