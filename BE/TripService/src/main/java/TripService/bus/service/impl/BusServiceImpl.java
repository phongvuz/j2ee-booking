package TripService.bus.service.impl;

import TripService.bus.dto.BusRequest;
import TripService.bus.dto.BusResponse;
import TripService.bus.entity.Bus;
import TripService.bus.mapper.BusMapper;
import TripService.bus.repository.BusRepository;
import TripService.bus.service.BusService;
import TripService.common.dto.PageResponse;
import TripService.common.exception.BusinessConflictException;
import TripService.common.exception.ResourceNotFoundException;
import TripService.trip.repository.TripRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BusServiceImpl implements BusService {

    private final BusRepository busRepository;
    private final TripRepository tripRepository;
    private final BusMapper busMapper;

    public BusServiceImpl(BusRepository busRepository, TripRepository tripRepository, BusMapper busMapper) {
        this.busRepository = busRepository;
        this.tripRepository = tripRepository;
        this.busMapper = busMapper;
    }

    @Override
    @Transactional
    public BusResponse create(BusRequest request) {
        if (busRepository.existsByBusCode(request.busCode())) {
            throw new BusinessConflictException("Bus code already exists.");
        }
        if (busRepository.existsByPlateNumber(request.plateNumber())) {
            throw new BusinessConflictException("Plate number already exists.");
        }
        return busMapper.toResponse(busRepository.saveAndFlush(busMapper.toEntity(request)));
    }

    @Override
    public BusResponse getById(Long id) {
        return busMapper.toResponse(busRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bus", id)));
    }

    @Override
    public PageResponse<BusResponse> getAll(int page, int size) {
        return PageResponse.from(busRepository.findAll(PageRequest.of(page, size, Sort.by("id")))
                .map(busMapper::toResponse));
    }

    @Override
    @Transactional
    public BusResponse update(Long id, BusRequest request) {
        Bus bus = findForUpdate(id);
        if (busRepository.existsByBusCodeAndIdNot(request.busCode(), id)) {
            throw new BusinessConflictException("Bus code already exists.");
        }
        if (busRepository.existsByPlateNumberAndIdNot(request.plateNumber(), id)) {
            throw new BusinessConflictException("Plate number already exists.");
        }
        if (bus.getSeatCount() != request.seatCount() && tripRepository.existsByBusId(id)) {
            throw new BusinessConflictException("Cannot change seat count while trips reference this bus.");
        }
        busMapper.updateEntity(request, bus);
        return busMapper.toResponse(busRepository.saveAndFlush(bus));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Bus bus = findForUpdate(id);
        if (tripRepository.existsByBusId(id)) {
            throw new BusinessConflictException("Cannot delete a bus that is assigned to trips.");
        }
        busRepository.delete(bus);
        busRepository.flush();
    }

    private Bus findForUpdate(Long id) {
        return busRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bus", id));
    }
}
