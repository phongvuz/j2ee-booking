package com.nhom.booking.controllers;

import com.nhom.booking.dtos.order.BookedSeatsDTO;
import com.nhom.booking.interfaces.order.IOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ghế đã đặt của một chuyến, để frontend tô xám trên sơ đồ ghế.
 * Công khai (khách chưa đăng nhập vẫn được xem sơ đồ ghế).
 * Dữ liệu nằm ở bảng order_seats nên đặt trong module Order; dùng chung prefix
 * /api/v1/trips với controller của module Trips (khác đường dẫn nên không trùng).
 */
@RestController
@RequestMapping("/api/v1/trips")
@RequiredArgsConstructor
public class TripSeatController {

    private final IOrder orderService;

    @GetMapping("/{tripId}/booked-seats")
    public ResponseEntity<BookedSeatsDTO> getBookedSeats(@PathVariable Long tripId) {
        return ResponseEntity.ok(orderService.getBookedSeats(tripId));
    }
}
