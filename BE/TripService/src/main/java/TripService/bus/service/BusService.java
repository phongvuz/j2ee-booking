package TripService.bus.service;

import TripService.bus.dto.BusRequest;
import TripService.bus.dto.BusResponse;
import TripService.common.dto.PageResponse;

public interface BusService {

    BusResponse create(BusRequest request);
    BusResponse getById(Long id);
    PageResponse<BusResponse> getAll(int page, int size);
    BusResponse update(Long id, BusRequest request);
    void delete(Long id);
}
