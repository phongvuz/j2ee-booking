package com.nhom.booking.dtos.order;

import com.nhom.booking.entities.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/** Dữ liệu đơn vé trả về cho frontend. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderDTO {
    private Long id;
    private String pnrCode;
    private String customerName;
    private String customerPhone;
    private Long userId;

    // Thông tin chuyến
    private Long tripId;
    private String tripCode;
    private String departure;
    private String destination;
    private LocalDate departureDate;
    private LocalTime departureTime;

    private List<String> seats;
    private BigDecimal totalPrice;
    private OrderStatus status;
    private LocalDateTime bookingDate;
}
