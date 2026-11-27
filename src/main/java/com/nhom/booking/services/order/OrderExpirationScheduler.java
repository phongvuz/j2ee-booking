package com.nhom.booking.services.order;

import com.nhom.booking.interfaces.order.IOrder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/** Định kỳ hủy các đơn PENDING quá hạn thanh toán để trả ghế lại cho khách khác. */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderExpirationScheduler {

    private final IOrder orderService;

    @Value("${app.order.pending-timeout-minutes:15}")
    private int timeoutMinutes;

    @Scheduled(fixedDelayString = "${app.order.expiration-check-ms:60000}")
    public void cancelExpiredOrders() {
        List<Long> expiredIds = orderService.findExpiredOrderIds(timeoutMinutes);
        for (Long id : expiredIds) {
            try {
                // mỗi đơn một transaction riêng: một đơn lỗi không ảnh hưởng đơn khác
                orderService.expireOrder(id);
                log.info("Đã tự hủy đơn quá hạn thanh toán, id = {}", id);
            } catch (Exception ex) {
                log.warn("Không thể tự hủy đơn id = {}", id, ex);
            }
        }
    }
}
