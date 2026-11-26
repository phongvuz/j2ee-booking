import { z } from "zod";
import { registerSchema } from "./register";

export const profileSchema = z.object({
  fullName: registerSchema.shape.fullName,
  email: registerSchema.shape.email,
  phone: registerSchema.shape.phone,
  address: registerSchema.shape.address,
});
export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại!").max(128),
  password: registerSchema.shape.password,
  confirmPassword: z.string().max(128),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không trùng khớp!", path: ["confirmPassword"],
}).refine((data) => data.password !== data.currentPassword, {
  message: "Mật khẩu mới phải khác mật khẩu hiện tại!", path: ["password"],
});
