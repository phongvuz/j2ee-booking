package com.nhom.booking.entities;

/** Trạng thái đơn vé (khớp CHECK constraint của bảng orders). */
public enum OrderStatus {
    PENDING,    // chờ thanh toán
    PAID,       // đã thanh toán
    CANCELLED   // đã hủy
}
