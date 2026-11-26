package TripService.bus.dto;

import TripService.bus.entity.BusStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record BusRequest(
        @NotBlank @Size(max = 20) String busCode,
        @NotBlank @Size(max = 20) String plateNumber,
        @NotBlank @Size(max = 100) String type,
        @NotNull @Positive Integer seatCount,
        @NotNull BusStatus status) {

    public BusRequest {
        busCode = busCode == null ? null : busCode.strip();
        plateNumber = plateNumber == null ? null : plateNumber.strip();
        type = type == null ? null : type.strip();
    }
}
