package TripService.trip.service;

import TripService.common.dto.PageResponse;
import TripService.trip.dto.TripRequest;
import TripService.trip.dto.TripResponse;
import java.time.LocalDate;

public interface TripService {

    TripResponse create(TripRequest request);
    TripResponse getById(Long id);
    PageResponse<TripResponse> search(String departure, String destination, LocalDate date,
            Long busId, int page, int size);
    TripResponse update(Long id, TripRequest request);
    void delete(Long id);
}
