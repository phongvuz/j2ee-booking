package TripService.trip.service.impl;

import TripService.bus.entity.Bus;
import TripService.bus.entity.BusStatus;
import TripService.bus.repository.BusRepository;
import TripService.common.dto.PageResponse;
import TripService.common.exception.BusinessConflictException;
import TripService.common.exception.InvalidRequestException;
import TripService.common.exception.ResourceNotFoundException;
import TripService.trip.dto.TripRequest;
import TripService.trip.dto.TripResponse;
import TripService.trip.entity.Trip;
import TripService.trip.mapper.TripMapper;
import TripService.trip.repository.TripRepository;
import TripService.trip.repository.TripSpecifications;
import TripService.trip.service.TripService;
import java.time.LocalDate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TripServiceImpl implements TripService {

    private final TripRepository tripRepository;
    private final BusRepository busRepository;
    private final TripMapper tripMapper;

    public TripServiceImpl(TripRepository tripRepository, BusRepository busRepository, TripMapper tripMapper) {
        this.tripRepository = tripRepository;
        this.busRepository = busRepository;
        this.tripMapper = tripMapper;
    }

    @Override
    @Transactional
    public TripResponse create(TripRequest request) {
        validateRoute(request);
        if (tripRepository.existsByTripCode(request.tripCode())) {
            throw new BusinessConflictException("Trip code already exists.");
        }
        Bus bus = findActiveBusForUpdate(request.busId());
        if (tripRepository.existsByBusIdAndDepartureDateAndDepartureTime(
                bus.getId(), request.departureDate(), request.departureTime())) {
            throw new BusinessConflictException("This bus already has a trip at the requested departure time.");
        }
        Trip trip = tripMapper.toEntity(request, bus, bus.getSeatCount());
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    @Override
    public TripResponse getById(Long id) {
        return tripMapper.toResponse(tripRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", id)));
    }

    @Override
    public PageResponse<TripResponse> search(String departure, String destination, LocalDate date,
            Long busId, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("departureDate", "departureTime", "id"));
        return PageResponse.from(tripRepository.findAll(
                TripSpecifications.search(departure, destination, date, busId), pageable)
                .map(tripMapper::toResponse));
    }

    @Override
    @Transactional
    public TripResponse update(Long id, TripRequest request) {
        Trip trip = findForUpdate(id);
        validateRoute(request);
        if (tripRepository.existsByTripCodeAndIdNot(request.tripCode(), id)) {
            throw new BusinessConflictException("Trip code already exists.");
        }
        boolean changingBus = !trip.getBus().getId().equals(request.busId());
        if (changingBus && hasBookedSeats(trip)) {
            throw new BusinessConflictException("Cannot reassign a trip with booked seats to another bus.");
        }
        Bus bus = findActiveBusForUpdate(request.busId());
        if (tripRepository.existsByBusIdAndDepartureDateAndDepartureTimeAndIdNot(
                bus.getId(), request.departureDate(), request.departureTime(), id)) {
            throw new BusinessConflictException("This bus already has a trip at the requested departure time.");
        }
        int emptySeats = changingBus ? bus.getSeatCount() : trip.getEmptySeats();
        tripMapper.updateEntity(request, bus, emptySeats, trip);
        return tripMapper.toResponse(tripRepository.saveAndFlush(trip));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Trip trip = findForUpdate(id);
        if (hasBookedSeats(trip)) {
            throw new BusinessConflictException("Cannot delete a trip with booked seats.");
        }
        tripRepository.delete(trip);
        tripRepository.flush();
    }

    private Trip findForUpdate(Long id) {
        return tripRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", id));
    }

    private Bus findActiveBusForUpdate(Long id) {
        Bus bus = busRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bus", id));
        if (bus.getStatus() != BusStatus.ACTIVE) {
            throw new BusinessConflictException("Only active buses can be assigned to trips.");
        }
        return bus;
    }

    private void validateRoute(TripRequest request) {
        if (request.departure().equalsIgnoreCase(request.destination())) {
            throw new InvalidRequestException("Departure and destination must be different.");
        }
    }

    private boolean hasBookedSeats(Trip trip) {
        return trip.getEmptySeats() < trip.getBus().getSeatCount();
    }
}
