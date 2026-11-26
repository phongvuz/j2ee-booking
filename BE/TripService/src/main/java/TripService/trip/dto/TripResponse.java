package TripService.trip.dto;

import TripService.bus.dto.BusResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record TripResponse(Long id, String tripCode, BusResponse bus, String departure, String destination,
        LocalDate departureDate, LocalTime departureTime, BigDecimal price, int emptySeats) {
}
