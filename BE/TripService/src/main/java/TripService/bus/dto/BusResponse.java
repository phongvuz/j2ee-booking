package TripService.bus.dto;

import TripService.bus.entity.BusStatus;

public record BusResponse(Long id, String busCode, String plateNumber, String type,
        int seatCount, BusStatus status) {
}
