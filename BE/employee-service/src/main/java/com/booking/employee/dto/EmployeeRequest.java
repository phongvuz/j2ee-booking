package com.booking.employee.dto;

import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

public record EmployeeRequest(String msnv, String name, String role, String phone) {

    public void validate() {
        requireText("msnv", msnv, 20);
        requireText("name", name, 150);
        requireText("role", role, 50);
        requireText("phone", phone, 20);
    }

    private static void requireText(String field, String value, int maxLength) {
        if (!StringUtils.hasText(value) || value.indexOf('\0') >= 0
                || value.codePointCount(0, value.length()) > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " phải có nội dung hợp lệ và dài tối đa " + maxLength + " ký tự.");
        }
    }
}
