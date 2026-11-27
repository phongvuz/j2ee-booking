package com.nhom.booking.exception;

/** Du lieu bi trung (vd: ghe da co nguoi dat) -> HTTP 409. */
public class DuplicateResourceException extends RuntimeException {
    public DuplicateResourceException(String message) {
        super(message);
    }
}
