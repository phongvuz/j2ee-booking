package TripService.trip.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record TripRequest(
        @NotBlank @Size(max = 20) String tripCode,
        @NotNull @Positive Long busId,
        @NotBlank @Size(max = 100) String departure,
        @NotBlank @Size(max = 100) String destination,
        @NotNull LocalDate departureDate,
        @NotNull LocalTime departureTime,
        @NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal price) {

    public TripRequest {
        tripCode = tripCode == null ? null : tripCode.strip();
        departure = departure == null ? null : departure.strip();
        destination = destination == null ? null : destination.strip();
    }
}
