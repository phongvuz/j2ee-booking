package TripService.bus.mapper;

import TripService.bus.dto.BusRequest;
import TripService.bus.dto.BusResponse;
import TripService.bus.entity.Bus;
import org.springframework.stereotype.Component;

@Component
public class BusMapper {

    public Bus toEntity(BusRequest request) {
        return new Bus(request.busCode(), request.plateNumber(), request.type(),
                request.seatCount(), request.status());
    }

    public void updateEntity(BusRequest request, Bus bus) {
        bus.updateDetails(request.busCode(), request.plateNumber(), request.type(),
                request.seatCount(), request.status());
    }

    public BusResponse toResponse(Bus bus) {
        return new BusResponse(bus.getId(), bus.getBusCode(), bus.getPlateNumber(),
                bus.getType(), bus.getSeatCount(), bus.getStatus());
    }
}
