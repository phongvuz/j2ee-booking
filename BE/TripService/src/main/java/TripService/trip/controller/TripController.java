package TripService.trip.controller;

import TripService.common.dto.PageResponse;
import TripService.trip.dto.TripRequest;
import TripService.trip.dto.TripResponse;
import TripService.trip.service.TripService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.net.URI;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @PostMapping
    public ResponseEntity<TripResponse> create(@Valid @RequestBody TripRequest request) {
        TripResponse response = tripService.create(request);
        return ResponseEntity.created(URI.create("/api/trips/" + response.id())).body(response);
    }

    @GetMapping("/{id}")
    public TripResponse getById(@PathVariable @Positive Long id) {
        return tripService.getById(id);
    }

    @GetMapping
    public PageResponse<TripResponse> search(
            @RequestParam(required = false) String departure,
            @RequestParam(required = false) String destination,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate departureDate,
            @RequestParam(required = false) @Positive Long busId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return tripService.search(departure, destination, departureDate, busId, page, size);
    }

    @PutMapping("/{id}")
    public TripResponse update(@PathVariable @Positive Long id, @Valid @RequestBody TripRequest request) {
        return tripService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable @Positive Long id) {
        tripService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
