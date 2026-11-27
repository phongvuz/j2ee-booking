package com.nhom.booking.controllers;

import com.nhom.booking.dtos.common.PageResponse;
import com.nhom.booking.dtos.order.OrderCreateRequest;
import com.nhom.booking.dtos.order.OrderDTO;
import com.nhom.booking.dtos.order.OrderUpdateRequest;
import com.nhom.booking.entities.OrderStatus;
import com.nhom.booking.interfaces.order.IOrder;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final IOrder orderService;

    // TODO (sau khi có JWT): chỉ ADMIN được gọi endpoint này
    @GetMapping
    public ResponseEntity<PageResponse<OrderDTO>> getOrders(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(orderService.getOrders(keyword, status, page, size));
    }

    // Công khai: tra cứu bằng PNR + SĐT
    @GetMapping("/search")
    public ResponseEntity<OrderDTO> lookup(@RequestParam String pnr, @RequestParam String phone) {
        return ResponseEntity.ok(orderService.lookup(pnr, phone));
    }

    // TODO (sau khi có JWT): chỉ chủ đơn hoặc ADMIN được xem
    @GetMapping("/{id}")
    public ResponseEntity<OrderDTO> getOrderById(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.getById(id));
    }

    // TODO (sau khi có JWT): yêu cầu đăng nhập, user lấy từ token thay vì body
    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(@Valid @RequestBody OrderCreateRequest request) {
        OrderDTO created = orderService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/orders/" + created.getId())).body(created);
    }

    // TODO (sau khi có JWT): chỉ ADMIN
    @PutMapping("/{id}")
    public ResponseEntity<OrderDTO> updateOrder(@PathVariable Long id,
                                                @Valid @RequestBody OrderUpdateRequest request) {
        return ResponseEntity.ok(orderService.update(id, request));
    }

    // TODO (sau khi có JWT): chỉ ADMIN (hoặc gắn với cổng thanh toán)
    @PatchMapping("/{id}/pay")
    public ResponseEntity<OrderDTO> payOrder(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.pay(id));
    }

    // TODO (sau khi có JWT): chủ đơn hoặc ADMIN. Đây là xóa mềm (đổi sang CANCELLED).
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelOrder(@PathVariable Long id) {
        orderService.cancel(id);
        return ResponseEntity.noContent().build();
    }
}
