package com.booking.employee.dashboard;

import com.booking.employee.service.EmployeeService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class DashboardService {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private final EmployeeService employees;
    private final DashboardSources sources;

    DashboardService(EmployeeService employees, DashboardSources sources) {
        this.employees = employees;
        this.sources = sources;
    }

    Stats stats(LocalDate from, LocalDate to, String token) {
        if (from == null && to == null) {
            from = LocalDate.now(VIETNAM);
            to = from;
        }
        if (from == null || to == null || to.isBefore(from) || LocalDate.MAX.equals(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cần cả from và to, với from không sau to và to có ngày kế tiếp.");
        }
        var orders = sources.orders(from.atStartOfDay(VIETNAM).toInstant(),
                to.plusDays(1).atStartOfDay(VIETNAM).toInstant(), token);
        return new Stats(from, to, orders.revenueVnd(), orders.ticketsSold(), sources.activeBuses(token),
                employees.headcount());
    }

    record Stats(LocalDate from, LocalDate to, BigDecimal revenueVnd, long ticketsSold, long activeBuses,
                 EmployeeService.Headcount employees) {
    }
}
