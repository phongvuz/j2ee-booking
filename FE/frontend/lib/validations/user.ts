import { z } from "zod";

export const userSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên phải từ 2 ký tự trở lên")
    .max(100, "Họ tên tối đa 100 ký tự"),
  phone: z
    .string()
    .trim()
    .regex(
      /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/,
      "Số điện thoại không hợp lệ (VD: 0901234567)"
    ),
  password: z
    .string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
    .max(128, "Mật khẩu tối đa 128 ký tự")
    .optional()
    .or(z.literal("")),
  role: z.enum(["USER", "ADMIN", "CUSTOMER"]).default("USER"),
  isActive: z.boolean().default(true),
});

export type UserFormValues = z.infer<typeof userSchema>;
