package com.nhom.booking.dtos.order;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Dữ liệu client gửi lên khi đặt vé. Tổng tiền KHÔNG nhận từ client, server tự tính. */
@Data
@NoArgsConstructor
public class OrderCreateRequest {

    @NotNull(message = "Thiếu mã chuyến")
    private Long tripId;

    // TODO (sau khi có JWT): bỏ trường này, lấy user hiện tại từ SecurityContext
    @NotNull(message = "Thiếu người đặt")
    private Long userId;

    @NotBlank(message = "Vui lòng nhập họ tên")
    @Size(max = 150, message = "Họ tên tối đa 150 ký tự")
    private String customerName;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    @Pattern(regexp = "^(0|\\+84)\\d{9}$", message = "Số điện thoại không hợp lệ")
    private String customerPhone;

    @NotEmpty(message = "Vui lòng chọn ít nhất 1 ghế")
    @Size(max = 5, message = "Mỗi đơn đặt tối đa 5 ghế")
    private List<@NotBlank(message = "Mã ghế không được để trống")
                 @Pattern(regexp = "^\\d[A-Z]\\d{1,2}$", message = "Mã ghế không hợp lệ (ví dụ: 1A1)") String> seats;
}
