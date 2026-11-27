package com.nhom.booking.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Bật @Scheduled (dùng cho việc tự hủy đơn quá hạn thanh toán). */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
