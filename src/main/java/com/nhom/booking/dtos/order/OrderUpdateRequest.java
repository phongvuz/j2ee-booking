package com.nhom.booking.dtos.order;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Sửa thông tin khách trên đơn. Không cho đổi chuyến, ghế, giá hay trạng thái ở đây. */
@Data
@NoArgsConstructor
public class OrderUpdateRequest {

    @NotBlank(message = "Vui lòng nhập họ tên")
    @Size(max = 150, message = "Họ tên tối đa 150 ký tự")
    private String customerName;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    @Pattern(regexp = "^(0|\\+84)\\d{9}$", message = "Số điện thoại không hợp lệ")
    private String customerPhone;
}
