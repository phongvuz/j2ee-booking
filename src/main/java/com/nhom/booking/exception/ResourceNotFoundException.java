package com.nhom.booking.exception;

/** Khong tim thay du lieu -> HTTP 404. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
