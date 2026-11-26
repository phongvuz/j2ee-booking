package TripService.trip.mapper;

import TripService.bus.entity.Bus;
import TripService.bus.mapper.BusMapper;
import TripService.trip.dto.TripRequest;
import TripService.trip.dto.TripResponse;
import TripService.trip.entity.Trip;
import org.springframework.stereotype.Component;

@Component
public class TripMapper {

    private final BusMapper busMapper;

    public TripMapper(BusMapper busMapper) {
        this.busMapper = busMapper;
    }

    public Trip toEntity(TripRequest request, Bus bus, int emptySeats) {
        return new Trip(request.tripCode(), bus, request.departure(), request.destination(),
                request.departureDate(), request.departureTime(), request.price(), emptySeats);
    }

    public void updateEntity(TripRequest request, Bus bus, int emptySeats, Trip trip) {
        trip.updateDetails(request.tripCode(), bus, request.departure(), request.destination(),
                request.departureDate(), request.departureTime(), request.price(), emptySeats);
    }

    public TripResponse toResponse(Trip trip) {
        return new TripResponse(trip.getId(), trip.getTripCode(), busMapper.toResponse(trip.getBus()),
                trip.getDeparture(), trip.getDestination(), trip.getDepartureDate(),
                trip.getDepartureTime(), trip.getPrice(), trip.getEmptySeats());
    }
}
