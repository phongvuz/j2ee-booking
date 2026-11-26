package TripService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import TripService.bus.entity.BusStatus;
import TripService.bus.repository.BusRepository;
import TripService.trip.entity.Trip;
import TripService.trip.repository.TripRepository;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TripServiceApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private BusRepository busRepository;

    @Autowired
    private TripRepository tripRepository;

    @BeforeEach
    void cleanDatabase() {
        tripRepository.deleteAllInBatch();
        busRepository.deleteAllInBatch();
    }

    @Test
    void busCrudReturnsDtosAndPagination() throws Exception {
        long id = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);

        mvc.perform(get("/api/buses/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.busCode").value("BUS-001"))
                .andExpect(jsonPath("$.seatCount").value(22));
        mvc.perform(get("/api/buses").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(id))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.page").value(0));
        mvc.perform(put("/api/buses/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content(busJson("BUS-001", "51B-123.45", 34, BusStatus.INACTIVE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seatCount").value(34))
                .andExpect(jsonPath("$.status").value("INACTIVE"));
        mvc.perform(delete("/api/buses/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/buses/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    void rejectsDuplicateBusCodeAndPlateNumber() throws Exception {
        createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        mvc.perform(post("/api/buses").contentType(MediaType.APPLICATION_JSON)
                        .content(busJson("BUS-001", "51B-999.99", 22, BusStatus.ACTIVE)))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/buses").contentType(MediaType.APPLICATION_JSON)
                        .content(busJson("BUS-002", "51B-123.45", 22, BusStatus.ACTIVE)))
                .andExpect(status().isConflict());
        assertThat(busRepository.count()).isEqualTo(1);
    }

    @Test
    void validatesBusFieldsAndReturnsFieldErrors() throws Exception {
        mvc.perform(post("/api/buses").contentType(MediaType.APPLICATION_JSON)
                        .content(busJson("   ", "51B-123.45", 0, BusStatus.ACTIVE)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.busCode").exists())
                .andExpect(jsonPath("$.errors.seatCount").exists());
        assertThat(busRepository.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/buses?page=-1", "/api/buses?size=0", "/api/buses?size=101",
            "/api/buses/0", "/api/trips?busId=-1", "/api/trips?page=-1",
            "/api/trips?size=101", "/api/trips?departureDate=invalid", "/api/trips/-1"
    })
    void rejectsInvalidPathAndQueryParameters(String uri) throws Exception {
        mvc.perform(get(uri)).andExpect(status().isBadRequest());
    }

    @Test
    void missingResourcesReturnNotFound() throws Exception {
        mvc.perform(get("/api/buses/999999")).andExpect(status().isNotFound());
        mvc.perform(get("/api/trips/999999")).andExpect(status().isNotFound());
        mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", 999999, "SGN", "DLT", "2026-12-01", "21:00:00")))
                .andExpect(status().isNotFound());
    }

    @Test
    void malformedPayloadReturnsBadRequest() throws Exception {
        mvc.perform(post("/api/buses").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/buses").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"busCode":"BUS-001","plateNumber":"51B-123.45","type":"Bus",
                                 "seatCount":22,"status":"UNKNOWN"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void tripCrudInitializesSeatsFromBusAndReturnsNestedBusDto() throws Exception {
        long busId = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        long tripId = createTrip("VN01", busId, "SGN", "DLT", "2026-12-01", "21:00:00");

        mvc.perform(get("/api/trips/{id}", tripId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bus.id").value(busId))
                .andExpect(jsonPath("$.emptySeats").value(22));
        mvc.perform(put("/api/trips/{id}", tripId).contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", busId, "SGN", "NHA", "2026-12-01", "21:00:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.destination").value("NHA"))
                .andExpect(jsonPath("$.emptySeats").value(22));
        mvc.perform(delete("/api/trips/{id}", tripId)).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/{id}", tripId)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/buses/{id}", busId)).andExpect(status().isNoContent());
    }

    @Test
    void tripSearchCombinesFiltersAndPaginates() throws Exception {
        long firstBus = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        long secondBus = createBus("BUS-002", "51B-678.90", 34, BusStatus.ACTIVE);
        createTrip("VN01", firstBus, "SGN", "DLT", "2026-12-01", "21:00:00");
        createTrip("VN02", secondBus, "SGN", "DLT", "2026-12-01", "22:00:00");
        createTrip("VN03", firstBus, "SGN", "NHA", "2026-12-02", "21:00:00");

        mvc.perform(get("/api/trips").param("departure", " sgn ").param("destination", "dlt")
                        .param("departureDate", "2026-12-01").param("size", "1").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].tripCode").value("VN02"));
        mvc.perform(get("/api/trips").param("busId", Long.toString(firstBus)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/trips").param("destination", "HAN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @ParameterizedTest
    @EnumSource(value = BusStatus.class, names = {"MAINTENANCE", "INACTIVE"})
    void rejectsTripsAssignedToUnavailableBus(BusStatus busStatus) throws Exception {
        long busId = createBus("BUS-001", "51B-123.45", 22, busStatus);
        mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", busId, "SGN", "DLT", "2026-12-01", "21:00:00")))
                .andExpect(status().isConflict());
        assertThat(tripRepository.count()).isZero();
    }

    @Test
    void validatesRouteAndTripFields() throws Exception {
        long busId = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", busId, " SGN ", "sgn", "2026-12-01", "21:00:00")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tripCode":"VN01","busId":%d,"departure":"SGN","destination":"DLT",
                                 "departureDate":"2026-12-01","price":-1}
                                """.formatted(busId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.departureTime").exists())
                .andExpect(jsonPath("$.errors.price").exists());
    }

    @Test
    void preventsDuplicateTripCodesAndDepartureAssignments() throws Exception {
        long firstBus = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        long secondBus = createBus("BUS-002", "51B-678.90", 34, BusStatus.ACTIVE);
        createTrip("VN01", firstBus, "SGN", "DLT", "2026-12-01", "21:00:00");

        mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", secondBus, "SGN", "NHA", "2026-12-01", "22:00:00")))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN02", firstBus, "SGN", "NHA", "2026-12-01", "21:00:00")))
                .andExpect(status().isConflict());
        createTrip("VN02", secondBus, "SGN", "NHA", "2026-12-01", "21:00:00");
        assertThat(tripRepository.count()).isEqualTo(2);
    }

    @Test
    void conflictingUpdatesLeaveExistingDataUnchanged() throws Exception {
        long firstBus = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        long secondBus = createBus("BUS-002", "51B-678.90", 34, BusStatus.ACTIVE);
        createTrip("VN01", firstBus, "SGN", "DLT", "2026-12-01", "21:00:00");
        long tripId = createTrip("VN02", firstBus, "SGN", "NHA", "2026-12-01", "22:00:00");

        mvc.perform(put("/api/trips/{id}", tripId).contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN02", firstBus, "SGN", "NHA", "2026-12-01", "21:00:00")))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/trips/{id}", tripId).contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", firstBus, "SGN", "NHA", "2026-12-01", "22:00:00")))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/buses/{id}", secondBus).contentType(MediaType.APPLICATION_JSON)
                        .content(busJson("BUS-002", "51B-123.45", 34, BusStatus.ACTIVE)))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/trips/{id}", tripId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripCode").value("VN02"))
                .andExpect(jsonPath("$.departureTime").value("22:00:00"));
        assertThat(busRepository.findById(secondBus).orElseThrow().getPlateNumber()).isEqualTo("51B-678.90");
    }

    @Test
    void simultaneousAssignmentsToSameBusAndDepartureAllowOnlyOneTrip() throws Exception {
        long busId = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        CyclicBarrier start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                                .content(tripJson("VN01", busId, "SGN", "DLT", "2026-12-01", "21:00:00")))
                        .andReturn().getResponse().getStatus();
            });
            var second = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                                .content(tripJson("VN02", busId, "SGN", "NHA", "2026-12-01", "21:00:00")))
                        .andReturn().getResponse().getStatus();
            });
            assertThat(new Integer[] {first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)})
                    .containsExactlyInAnyOrder(201, 409);
        }
        assertThat(tripRepository.count()).isEqualTo(1);
    }

    @Test
    void preventsDeletingAssignedBusAndChangingItsSeatCount() throws Exception {
        long busId = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        createTrip("VN01", busId, "SGN", "DLT", "2026-12-01", "21:00:00");

        mvc.perform(delete("/api/buses/{id}", busId)).andExpect(status().isConflict());
        mvc.perform(put("/api/buses/{id}", busId).contentType(MediaType.APPLICATION_JSON)
                        .content(busJson("BUS-001", "51B-123.45", 34, BusStatus.ACTIVE)))
                .andExpect(status().isConflict());
        assertThat(busRepository.findById(busId).orElseThrow().getSeatCount()).isEqualTo(22);
    }

    @Test
    void reassignsUnbookedTripAndUsesNewBusCapacity() throws Exception {
        long firstBus = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        long secondBus = createBus("BUS-002", "51B-678.90", 34, BusStatus.ACTIVE);
        long tripId = createTrip("VN01", firstBus, "SGN", "DLT", "2026-12-01", "21:00:00");

        mvc.perform(put("/api/trips/{id}", tripId).contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", secondBus, "SGN", "DLT", "2026-12-01", "21:00:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bus.id").value(secondBus))
                .andExpect(jsonPath("$.emptySeats").value(34));
    }

    @Test
    void preservesBookedSeatCountAndRejectsReassignmentOrDeletion() throws Exception {
        long firstBus = createBus("BUS-001", "51B-123.45", 22, BusStatus.ACTIVE);
        long secondBus = createBus("BUS-002", "51B-678.90", 34, BusStatus.ACTIVE);
        // Simulate inventory already changed by the booking workflow.
        Trip trip = tripRepository.saveAndFlush(new Trip("VN01", busRepository.findById(firstBus).orElseThrow(),
                "SGN", "DLT", LocalDate.of(2026, 12, 1), LocalTime.of(21, 0),
                new BigDecimal("300000.00"), 20));

        mvc.perform(put("/api/trips/{id}", trip.getId()).contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", firstBus, "SGN", "DLT", "2026-12-01", "21:00:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emptySeats").value(20));
        mvc.perform(put("/api/trips/{id}", trip.getId()).contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson("VN01", secondBus, "SGN", "DLT", "2026-12-01", "21:00:00")))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/trips/{id}", trip.getId())).andExpect(status().isConflict());
        assertThat(tripRepository.findById(trip.getId()).orElseThrow().getEmptySeats()).isEqualTo(20);
    }

    private long createBus(String code, String plate, int seats, BusStatus busStatus) throws Exception {
        MvcResult result = mvc.perform(post("/api/buses").contentType(MediaType.APPLICATION_JSON)
                        .content(busJson(code, plate, seats, busStatus)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private long createTrip(String code, long busId, String departure, String destination,
            String date, String time) throws Exception {
        MvcResult result = mvc.perform(post("/api/trips").contentType(MediaType.APPLICATION_JSON)
                        .content(tripJson(code, busId, departure, destination, date, time)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private String busJson(String code, String plate, int seats, BusStatus busStatus) {
        return """
                {"busCode":"%s","plateNumber":"%s","type":"Limousine",
                 "seatCount":%d,"status":"%s"}
                """.formatted(code, plate, seats, busStatus);
    }

    private String tripJson(String code, long busId, String departure, String destination,
            String date, String time) {
        return """
                {"tripCode":"%s","busId":%d,"departure":"%s","destination":"%s",
                 "departureDate":"%s","departureTime":"%s","price":300000.00}
                """.formatted(code, busId, departure, destination, date, time);
    }
}
