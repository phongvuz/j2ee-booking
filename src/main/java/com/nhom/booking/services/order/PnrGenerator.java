package com.nhom.booking.services.order;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/** Sinh mã đặt chỗ dạng NHAXE-XXXXXX (bỏ các ký tự dễ nhầm: 0/O, 1/I). */
@Component
public class PnrGenerator {

    private static final String PREFIX = "NHAXE-";
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int LENGTH = 6;

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder sb = new StringBuilder(PREFIX);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
