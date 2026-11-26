package TripService.bus.controller;

import TripService.bus.dto.BusRequest;
import TripService.bus.dto.BusResponse;
import TripService.bus.service.BusService;
import TripService.common.dto.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.net.URI;
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
@RequestMapping("/api/buses")
public class BusController {

    private final BusService busService;

    public BusController(BusService busService) {
        this.busService = busService;
    }

    @PostMapping
    public ResponseEntity<BusResponse> create(@Valid @RequestBody BusRequest request) {
        BusResponse response = busService.create(request);
        return ResponseEntity.created(URI.create("/api/buses/" + response.id())).body(response);
    }

    @GetMapping("/{id}")
    public BusResponse getById(@PathVariable @Positive Long id) {
        return busService.getById(id);
    }

    @GetMapping
    public PageResponse<BusResponse> getAll(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return busService.getAll(page, size);
    }

    @PutMapping("/{id}")
    public BusResponse update(@PathVariable @Positive Long id, @Valid @RequestBody BusRequest request) {
        return busService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable @Positive Long id) {
        busService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
