package com.nhom.booking.exception;

/** Thao tác không hợp lệ với trạng thái hiện tại của dữ liệu (vd: thanh toán đơn đã hủy) -> HTTP 409. */
public class InvalidStateException extends RuntimeException {
    public InvalidStateException(String message) {
        super(message);
    }
}
