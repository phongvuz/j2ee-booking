package com.nhom.booking.dtos.order;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Danh sách ghế đã có người đặt (đang giữ chỗ hoặc đã thanh toán) của một chuyến. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookedSeatsDTO {
    private Long tripId;
    private List<String> bookedSeats;   // vd: ["1A1", "1A2"]
    private Integer availableSeats;
}
